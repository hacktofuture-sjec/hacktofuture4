package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/engine"
	"github.com/rekall/backend/internal/models"
	"github.com/rekall/backend/internal/store"
)

// ApprovalHandler holds the engine client needed to trigger learning.
type ApprovalHandler struct {
	engine *engine.Client
}

func NewApprovalHandler(eng *engine.Client) *ApprovalHandler {
	return &ApprovalHandler{engine: eng}
}

// Approve marks an incident as resolved and triggers the LearningAgent.
func (h *ApprovalHandler) Approve(c *gin.Context) {
	id := c.Param("id")

	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = models.ApprovalRequest{ReviewedBy: "human"}
	}
	if req.ReviewedBy == "" {
		req.ReviewedBy = "human"
	}

	incident, err := store.GetIncident(c.Request.Context(), id)
	if err != nil || incident == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}

	if err := store.UpdateIncidentStatus(c.Request.Context(), id, models.StatusResolved); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, _ = store.AppendAgentLog(c.Request.Context(), id, "learning", "done",
		"Fix approved by "+req.ReviewedBy+". Vault confidence updated.")

	if fix, err := store.GetLatestFixProposal(c.Request.Context(), id); err == nil && fix != nil {
		vaultID := ""
		if fix.VaultEntryID != nil {
			vaultID = *fix.VaultEntryID
		}
		fixDiff := ""
		if fix.FixDiff != nil {
			fixDiff = *fix.FixDiff
		}
		go func() {
			// Use a detached context — c.Request.Context() is cancelled as soon
			// as the HTTP response is sent, which would kill these calls.
			bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			_, _ = h.engine.Learn(bgCtx, engine.LearnRequest{
				IncidentID:    id,
				FixProposalID: fix.ID,
				Result:        "success",
				ReviewedBy:    req.ReviewedBy,
				Notes:         req.Notes,
				FixTier:       string(fix.Tier),
				VaultEntryID:  vaultID,
			})
			// After learning, open the GitHub PR now that a human has approved.
			_, _ = h.engine.CreatePR(bgCtx, engine.CreatePRRequest{
				IncidentID:     id,
				FixCommands:    fix.FixCommands,
				FixDescription: fix.FixDescription,
				FixTier:        string(fix.Tier),
				FixDiff:        fixDiff,
			})
		}()
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "incident_id": id, "action": "approved"})
}


// Reject marks an incident as failed and notifies the LearningAgent.
func (h *ApprovalHandler) Reject(c *gin.Context) {
	id := c.Param("id")

	var req models.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = models.ApprovalRequest{ReviewedBy: "human"}
	}
	if req.ReviewedBy == "" {
		req.ReviewedBy = "human"
	}

	incident, err := store.GetIncident(c.Request.Context(), id)
	if err != nil || incident == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "incident not found"})
		return
	}

	if err := store.UpdateIncidentStatus(c.Request.Context(), id, models.StatusFailed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, _ = store.AppendAgentLog(c.Request.Context(), id, "learning", "done",
		"Fix rejected by "+req.ReviewedBy+". Vault confidence decayed.")

	if fix, err := store.GetLatestFixProposal(c.Request.Context(), id); err == nil && fix != nil {
		vaultID := ""
		if fix.VaultEntryID != nil {
			vaultID = *fix.VaultEntryID
		}
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_, _ = h.engine.Learn(bgCtx, engine.LearnRequest{
				IncidentID:    id,
				FixProposalID: fix.ID,
				Result:        "rejected",
				ReviewedBy:    req.ReviewedBy,
				Notes:         req.Notes,
				FixTier:       string(fix.Tier),
				VaultEntryID:  vaultID,
			})
		}()
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "incident_id": id, "action": "rejected"})
}
