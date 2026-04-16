package engine_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rekall/backend/internal/engine"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockEngineServer creates a test HTTP server that responds to engine endpoints.
func mockEngineServer(t *testing.T, handlers map[string]http.HandlerFunc) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	for path, h := range handlers {
		mux.HandleFunc(path, h)
	}
	return httptest.NewServer(mux)
}

func TestClient_Healthy_ReturnsTrue(t *testing.T) {
	srv := mockEngineServer(t, map[string]http.HandlerFunc{
		"/health": func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	})
	defer srv.Close()

	c := engine.NewClient(srv.URL)
	assert.True(t, c.Healthy(context.Background()))
}

func TestClient_Healthy_ReturnsFalseOnError(t *testing.T) {
	c := engine.NewClient("http://127.0.0.1:0") // unreachable
	assert.False(t, c.Healthy(context.Background()))
}

func TestClient_RunPipeline_Success(t *testing.T) {
	srv := mockEngineServer(t, map[string]http.HandlerFunc{
		"/pipeline/run": func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

			var req engine.PipelineRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			assert.Equal(t, "test-incident-1", req.IncidentID)

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(engine.PipelineResponse{OK: true})
		},
	})
	defer srv.Close()

	c := engine.NewClient(srv.URL)
	resp, err := c.RunPipeline(context.Background(), engine.PipelineRequest{
		IncidentID: "test-incident-1",
		Payload:    map[string]any{"scenario": "test_failure"},
	})
	require.NoError(t, err)
	assert.True(t, resp.OK)
}

func TestClient_RunPipeline_ServerError(t *testing.T) {
	srv := mockEngineServer(t, map[string]http.HandlerFunc{
		"/pipeline/run": func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error": "engine exploded"}`))
		},
	})
	defer srv.Close()

	c := engine.NewClient(srv.URL)
	resp, err := c.RunPipeline(context.Background(), engine.PipelineRequest{
		IncidentID: "inc-err",
		Payload:    map[string]any{},
	})
	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "500")
}

func TestClient_Learn_Success(t *testing.T) {
	srv := mockEngineServer(t, map[string]http.HandlerFunc{
		"/pipeline/learn": func(w http.ResponseWriter, r *http.Request) {
			var req engine.LearnRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			assert.Equal(t, "success", req.Result)

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(engine.PipelineResponse{OK: true})
		},
	})
	defer srv.Close()

	c := engine.NewClient(srv.URL)
	resp, err := c.Learn(context.Background(), engine.LearnRequest{
		IncidentID:    "inc-learn",
		FixProposalID: "fp-1",
		Result:        "success",
		ReviewedBy:    "engineer@example.com",
	})
	require.NoError(t, err)
	assert.True(t, resp.OK)
}
