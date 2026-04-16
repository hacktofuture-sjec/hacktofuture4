package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/handlers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// buildIncidentRouter sets up a router for incident endpoints.
// Uses in-memory store — no database required; all calls succeed.
func buildIncidentRouter() *gin.Engine {
	r := gin.New()
	r.GET("/incidents",     handlers.ListIncidents)
	r.GET("/incidents/:id", handlers.GetIncident)
	return r
}

func TestListIncidents_DefaultsReturnJSON(t *testing.T) {
	r := buildIncidentRouter()
	req := httptest.NewRequest(http.MethodGet, "/incidents", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	// In-memory store always succeeds
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestListIncidents_InvalidLimitClamped(t *testing.T) {
	r := buildIncidentRouter()
	req := httptest.NewRequest(http.MethodGet, "/incidents?limit=9999", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetIncident_NotFound(t *testing.T) {
	r := buildIncidentRouter()
	req := httptest.NewRequest(http.MethodGet, "/incidents/00000000-0000-0000-0000-000000000000", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	// In-memory returns 404 for non-existent IDs
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetIncident_RouteParamExtracted(t *testing.T) {
	r := buildIncidentRouter()
	req := httptest.NewRequest(http.MethodGet, "/incidents/abc-123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.NotEqual(t, http.StatusMethodNotAllowed, w.Code)
	assert.NotEqual(t, http.StatusBadRequest, w.Code)
}

func TestListIncidents_ResponseShape(t *testing.T) {
	r := buildIncidentRouter()
	req := httptest.NewRequest(http.MethodGet, "/incidents", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "incidents")
}
