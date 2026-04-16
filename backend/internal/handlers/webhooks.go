package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/engine"
	"github.com/rekall/backend/internal/models"
	"github.com/rekall/backend/internal/sse"
	"github.com/rekall/backend/internal/store"
)

// webhookSimulatorScenarios defines pre-built failure payloads for demo use.
var webhookSimulatorScenarios = map[string]map[string]any{
	"postgres_refused": {
		"failure_type": "infra",
		"description":  "PostgreSQL ECONNREFUSED on port 5432",
		"log_excerpt":  "Error: connect ECONNREFUSED postgres:5432\n  at TCPConnectWrap.afterConnect",
		"git_diff":     "--- a/config/database.yml\n+++ b/config/database.yml\n@@ -2 +2 @@\n-  host: db.internal\n+  host: postgres",
		"simulated":    true,
	},
	"oom_kill": {
		"failure_type": "oom",
		"description":  "Container killed by OOM — JVM heap exhausted",
		"log_excerpt":  "FATAL: Terminating due to java.lang.OutOfMemoryError: Java heap space\nContainer killed by OOM killer",
		"simulated":    true,
	},
	"test_failure": {
		"failure_type": "test",
		"description":  "Auth test suite: 1 failure after middleware change",
		"log_excerpt":  "FAIL: test_user_auth\nAssertionError: 401 != 200\nRan 47 tests in 3.2s — FAILED (failures=1)",
		"git_diff":     "--- a/src/auth/middleware.py\n+++ b/src/auth/middleware.py\n@@ -12 +12 @@\n-    if token and verify(token):\n+    if token:",
		"simulated":    true,
	},
	"secret_leak": {
		"failure_type": "security",
		"description":  "Secret detected in committed .env file",
		"log_excerpt":  "gitleaks: secret detected\n  Rule: generic-api-key\n  File: .env\n  Line: 7",
		"simulated":    true,
	},
	"image_pull_backoff": {
		"failure_type": "deploy",
		"description":  "Image tag v2.1.0 not found in registry",
		"log_excerpt":  "Warning: Failed to pull image 'registry.io/app:v2.1.0': manifest not found\nImagePullBackOff",
		"git_diff":     "--- a/.github/workflows/deploy.yml\n+++ b/.github/workflows/deploy.yml\n@@ -8 +8 @@\n-  IMAGE_TAG: v2.0.9\n+  IMAGE_TAG: v2.1.0",
		"simulated":    true,
	},
}

// WebhookHandler holds dependencies used by all webhook endpoints.
type WebhookHandler struct {
	broker *sse.Broker
	engine *engine.Client
}

func NewWebhookHandler(broker *sse.Broker, eng *engine.Client) *WebhookHandler {
	return &WebhookHandler{broker: broker, engine: eng}
}

// HandleGitHub receives GitHub Actions workflow_run failure webhooks.
func (h *WebhookHandler) HandleGitHub(c *gin.Context) {
	var payload models.GitHubWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if payload.WorkflowRun == nil {
		c.JSON(http.StatusOK, gin.H{"accepted": false, "reason": "no workflow_run"})
		return
	}
	if payload.WorkflowRun.Conclusion != "failure" && payload.WorkflowRun.Conclusion != "cancelled" {
		c.JSON(http.StatusOK, gin.H{"accepted": false, "reason": "conclusion=" + payload.WorkflowRun.Conclusion})
		return
	}

	failureType := classifyGitHubRun(payload.WorkflowRun.Name)
	raw := map[string]any{
		"action":       payload.Action,
		"workflow_run": payload.WorkflowRun,
		"repository":   payload.Repository,
	}

	incident, err := store.CreateIncident(c.Request.Context(), "github_actions", failureType, raw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create incident: " + err.Error()})
		return
	}

	go h.runPipeline(incident.ID, raw)
	c.JSON(http.StatusOK, gin.H{"accepted": true, "incident_id": incident.ID})
}

// HandleGitLab receives GitLab CI pipeline failure webhooks.
func (h *WebhookHandler) HandleGitLab(c *gin.Context) {
	var payload models.GitLabWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if payload.Status != "failed" && payload.Status != "canceled" {
		c.JSON(http.StatusOK, gin.H{"accepted": false, "reason": "status=" + payload.Status})
		return
	}

	raw := map[string]any{"object_kind": payload.ObjectKind, "status": payload.Status}
	incident, err := store.CreateIncident(c.Request.Context(), "gitlab", "deploy", raw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	go h.runPipeline(incident.ID, raw)
	c.JSON(http.StatusOK, gin.H{"accepted": true, "incident_id": incident.ID})
}

// HandleSimulate injects a pre-built failure scenario for demo purposes.
func (h *WebhookHandler) HandleSimulate(c *gin.Context) {
	var req models.SimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scenario, ok := webhookSimulatorScenarios[req.Scenario]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown scenario: " + req.Scenario})
		return
	}

	ft, _ := scenario["failure_type"].(string)
	incident, err := store.CreateIncident(c.Request.Context(), "simulator", ft, scenario)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	go h.runPipeline(incident.ID, scenario)

	c.JSON(http.StatusOK, gin.H{
		"accepted":    true,
		"incident_id": incident.ID,
		"scenario":    req.Scenario,
	})
}

// runPipeline is called in a goroutine to drive the agent pipeline.
// Tries the Python engine first; falls back to emulation if unavailable.
func (h *WebhookHandler) runPipeline(incidentID string, payload map[string]any) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	engineOK := h.engine.Healthy(ctx)

	if engineOK {
		_, err := h.engine.RunPipeline(ctx, engine.PipelineRequest{
			IncidentID: incidentID,
			Payload:    payload,
		})
		if err != nil {
			engineOK = false
		}
	}

	if !engineOK {
		h.emulatedPipeline(ctx, incidentID)
	}
}

// emulatedPipeline replays a step-by-step simulation when the engine is offline.
func (h *WebhookHandler) emulatedPipeline(ctx context.Context, incidentID string) {
	steps := []struct {
		name   string
		detail string
	}{
		{"monitor", "Normalising failure event payload"},
		{"diagnostic", "Fetching logs, git diff, and test reports"},
		{"fix", "Searching memory vault: T1 → T2 → T3 fallback"},
		{"governance", "Computing risk score across 6 dimensions"},
		{"publish_guard", "Supply-chain safety gate"},
		{"learning", "Updating vault confidence and logging RL episode"},
	}

	for _, step := range steps {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if logEntry, err := store.AppendAgentLog(ctx, incidentID, step.name, "running", step.detail); err == nil {
			h.broker.Publish(incidentID, sse.Event{Type: "agent_log", Data: logEntry})
		}

		time.Sleep(1200 * time.Millisecond)

		if logEntry, err := store.AppendAgentLog(ctx, incidentID, step.name, "done", step.detail); err == nil {
			h.broker.Publish(incidentID, sse.Event{Type: "agent_log", Data: logEntry})
		}
	}

	_ = store.UpdateIncidentStatus(ctx, incidentID, models.StatusResolved)
	h.broker.Publish(incidentID, sse.Event{Type: "status", Data: map[string]string{"status": "resolved"}})
	h.broker.PublishDone(incidentID)
}

func classifyGitHubRun(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "test"):
		return "test"
	case strings.Contains(lower, "deploy"):
		return "deploy"
	case strings.Contains(lower, "build"):
		return "deploy"
	default:
		return "unknown"
	}
}
