package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/models"
	"github.com/rekall/backend/internal/store"
)

// ListIncidents returns paginated incidents sorted by created_at DESC.
func ListIncidents(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit < 1 || limit > 200 {
		limit = 50
	}

	incidents, err := store.ListIncidents(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if incidents == nil {
		incidents = []*models.Incident{}
	}
	c.JSON(http.StatusOK, gin.H{
		"incidents": incidents,
		"limit":     limit,
		"offset":    offset,
	})
}

// GetIncident returns the full detail view of a single incident.
func GetIncident(c *gin.Context) {
	id := c.Param("id")
	ctx := c.Request.Context()

	incident, err := store.GetIncident(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if incident == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}

	bundle, _ := store.GetDiagnosticBundle(ctx, id)
	fix, _ := store.GetLatestFixProposal(ctx, id)
	gov, _ := store.GetLatestGovernanceDecision(ctx, id)
	logs, _ := store.GetAgentLogs(ctx, id)

	c.JSON(http.StatusOK, models.IncidentDetail{
		Incident:           incident,
		DiagnosticBundle:   bundle,
		FixProposal:        fix,
		GovernanceDecision: gov,
		AgentLogs:          logs,
	})
}
