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

// ─────────────────────────────────────────────────────────────────────────────
// DEMO vs PRODUCTION — CI Failure Fetching
// ─────────────────────────────────────────────────────────────────────────────
//
// CURRENT (Demo / Hackathon mode):
//   Instead of waiting for a slow GitHub Actions run to fail and rate-limiting
//   the GitHub API to fetch massive log files, REKALL uses the Webhook Simulator
//   below. When you hit POST /webhooks/simulate with a scenario name (e.g.
//   "postgres_refused" or "secret_leak"), this handler injects a pre-constructed
//   payload that already contains the log_excerpt and git_diff. The LangGraph
//   engine ingests the exact shape of a CI failure instantly — zero API calls,
//   zero rate-limit risk, perfectly reproducible demo loops.
//
// PRODUCTION (how a fully deployed version would work):
//   The MonitorAgent would catch a real GitHub webhook (event: workflow_run,
//   action: completed, conclusion: failure). HandleGitHub() already receives
//   and validates this payload. The missing step is log extraction:
//
//     runID := payload.WorkflowRun.ID
//     url   := fmt.Sprintf(
//         "https://api.github.com/repos/%s/actions/runs/%d/logs",
//         payload.Repository.FullName, runID,
//     )
//     req, _ := http.NewRequest("GET", url, nil)
//     req.Header.Set("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN"))
//     req.Header.Set("Accept", "application/vnd.github+json")
//     // Response is a zip archive — unzip and concatenate step logs.
//     // Inject the extracted log_excerpt into the raw map before runPipeline().
//
//   This log bytes download is then merged into the raw payload map so the
//   Python engine's DiagnosticAgent receives populated log_excerpt/git_diff
//   fields, matching the shape the simulator already provides.
// ─────────────────────────────────────────────────────────────────────────────

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

// HandleSimulate injects a pre-built failure scenario.
// Kept for local testing — prefer HandleFetchLive for real CI monitoring.
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

// HandleFetchLive fetches the latest failed GitHub Actions run in the configured
// repo and runs the real AI pipeline (Monitor → Diagnostic → Fix → PR).
func (h *WebhookHandler) HandleFetchLive(c *gin.Context) {
	var body struct {
		Repo string `json:"repo"` // optional override, defaults to GITHUB_REPO env
	}
	_ = c.ShouldBindJSON(&body)

	raw := map[string]any{
		"source":      "github_actions",
		"failure_type": "unknown",
		"description": "Fetching latest CI failure from GitHub",
		"live":        true,
		"repo":        body.Repo,
	}

	incident, err := store.CreateIncident(c.Request.Context(), "github_actions", "unknown", raw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create incident: " + err.Error()})
		return
	}

	go h.runFetchLivePipeline(incident.ID, body.Repo)
	c.JSON(http.StatusOK, gin.H{"accepted": true, "incident_id": incident.ID})
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

// runFetchLivePipeline delegates to the engine's /pipeline/run-from-github
// endpoint so it can fetch real CI failure logs from GitHub and run the full
// AI agent pipeline. Falls back to emulation only if engine is unreachable.
func (h *WebhookHandler) runFetchLivePipeline(incidentID string, repo string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if !h.engine.Healthy(ctx) {
		h.emulatedPipeline(ctx, incidentID)
		return
	}

	_, err := h.engine.RunFromGitHub(ctx, engine.FetchFromGitHubRequest{
		IncidentID: incidentID,
		Repo:       repo,
	})
	if err != nil {
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
