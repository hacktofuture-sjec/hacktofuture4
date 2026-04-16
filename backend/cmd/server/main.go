package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rekall/backend/internal/config"
	"github.com/rekall/backend/internal/engine"
	"github.com/rekall/backend/internal/handlers"
	"github.com/rekall/backend/internal/middleware"
	"github.com/rekall/backend/internal/sse"
	"github.com/rekall/backend/internal/store"
	"github.com/rekall/backend/internal/vault"
)

func main() {
	// Load .env from repo root (best-effort; production uses real env vars)
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := config.Load()
	gin.SetMode(cfg.GinMode)

	// ── Vault (flat-file, no DB) ────────────────────────────────────────────
	vault.Init(cfg.VaultPath)
	log.Printf("[REKALL] vault loaded from %s", cfg.VaultPath)

	// ── Store (in-memory) ───────────────────────────────────────────────────
	if err := store.Load(cfg.VaultPath); err != nil {
		log.Printf("[REKALL] store load warning: %v", err)
	} else {
		log.Println("[REKALL] store loaded incidents successfully")
	}

	// ── SSE broker ─────────────────────────────────────────────────────────
	broker := sse.NewBroker()

	// ── Engine client ───────────────────────────────────────────────────────
	eng := engine.NewClient(cfg.EngineURL)

	// ── Handlers ────────────────────────────────────────────────────────────
	webhookHandler  := handlers.NewWebhookHandler(broker, eng)
	approvalHandler := handlers.NewApprovalHandler(eng)
	streamHandler   := handlers.NewStreamHandler(broker)
	callbackHandler := handlers.NewCallbackHandler(broker)

	// ── Router ──────────────────────────────────────────────────────────────
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.Logger())
	r.Use(middleware.CORS(cfg.CORSOrigins))

	// Health
	r.GET("/health", func(c *gin.Context) {
		engineUp := eng.Healthy(c.Request.Context())
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "rekall-backend",
			"engine":  engineUp,
		})
	})

	// Webhooks
	wh := r.Group("/webhook")
	{
		wh.POST("/github",     webhookHandler.HandleGitHub)
		wh.POST("/gitlab",     webhookHandler.HandleGitLab)
		wh.POST("/simulate",   webhookHandler.HandleSimulate)
		wh.POST("/fetch-live", webhookHandler.HandleFetchLive)
	}

	// Incidents
	inc := r.Group("/incidents")
	{
		inc.GET("",           handlers.ListIncidents)
		inc.GET("/:id",       handlers.GetIncident)
		inc.POST("/:id/approve", approvalHandler.Approve)
		inc.POST("/:id/reject",  approvalHandler.Reject)
	}

	// SSE stream
	r.GET("/stream/:id", streamHandler.Stream)

	// Vault (reads flat files)
	v := r.Group("/vault")
	{
		v.GET("",       handlers.ListVault)
		v.GET("/stats", handlers.VaultStats)
	}

	// Metrics
	m := r.Group("/metrics")
	{
		m.GET("/summary",  handlers.Summary)
		m.GET("/episodes", handlers.Episodes)
	}

	// Internal — called by the Python engine service only
	internal := r.Group("/internal")
	{
		internal.POST("/engine-callback", callbackHandler.Handle)
	}

	// ── HTTP server with graceful shutdown ──────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 0, // 0 = no timeout for SSE streams
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[REKALL] listening on :%s (mode=%s)", cfg.Port, cfg.GinMode)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[REKALL] shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[REKALL] shutdown error: %v", err)
	}
	
	if err := store.Save(cfg.VaultPath); err != nil {
		log.Printf("[REKALL] store save error: %v", err)
	} else {
		log.Println("[REKALL] store saved to disk")
	}
	
	log.Println("[REKALL] stopped")
}
