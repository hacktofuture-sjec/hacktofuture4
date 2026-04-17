package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/engine"
	"github.com/rekall/backend/internal/handlers"
	"github.com/rekall/backend/internal/sse"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// buildTestRouter wires a minimal Gin router with the webhook handler.
// It uses a real SSE broker and a no-op engine client (engine service offline).
func buildTestRouter() *gin.Engine {
	broker := sse.NewBroker()
	eng := engine.NewClient("http://127.0.0.1:0") // intentionally unreachable
	wh := handlers.NewWebhookHandler(broker, eng)

	r := gin.New()
	r.POST("/webhook/github",   wh.HandleGitHub)
	r.POST("/webhook/gitlab",   wh.HandleGitLab)
	r.POST("/webhook/simulate", wh.HandleSimulate)
	return r
}

// TestSimulate_UnknownScenario ensures an invalid scenario returns 400.
func TestSimulate_UnknownScenario(t *testing.T) {
	// Skip if no DB — this test only validates routing logic (no DB call reaches
	// the simulate handler before scenario validation).
	r := buildTestRouter()
	body, _ := json.Marshal(map[string]string{"scenario": "nonexistent_chaos"})
	req := httptest.NewRequest(http.MethodPost, "/webhook/simulate", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	// Unknown scenario returns 400 without touching the DB.
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "unknown scenario")
}

// TestGitHub_IgnoresNonFailure verifies that successful workflow_run events
// are ignored without creating an incident.
func TestGitHub_IgnoresNonFailure(t *testing.T) {
	r := buildTestRouter()
	body, _ := json.Marshal(map[string]any{
		"action": "completed",
		"workflow_run": map[string]string{
			"name":       "CI",
			"conclusion": "success", // not a failure
			"html_url":   "https://github.com/org/repo/actions/runs/1",
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/webhook/github", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, false, resp["accepted"])
}

// TestGitHub_MissingWorkflowRun verifies handling of malformed payloads.
func TestGitHub_MissingWorkflowRun(t *testing.T) {
	r := buildTestRouter()
	body, _ := json.Marshal(map[string]string{"action": "completed"})
	req := httptest.NewRequest(http.MethodPost, "/webhook/github", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, false, resp["accepted"])
}

// TestGitLab_IgnoresSuccessStatus verifies non-failed pipelines are skipped.
func TestGitLab_IgnoresSuccessStatus(t *testing.T) {
	r := buildTestRouter()
	body, _ := json.Marshal(map[string]string{"object_kind": "pipeline", "status": "success"})
	req := httptest.NewRequest(http.MethodPost, "/webhook/gitlab", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, false, resp["accepted"])
}

// TestWebhook_BadJSON verifies 400 on completely invalid JSON.
func TestWebhook_BadJSON(t *testing.T) {
	r := buildTestRouter()
	req := httptest.NewRequest(http.MethodPost, "/webhook/simulate",
		bytes.NewReader([]byte(`{not valid json}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
