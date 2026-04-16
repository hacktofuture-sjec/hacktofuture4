package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/models"
	"github.com/rekall/backend/internal/sse"
	"github.com/rekall/backend/internal/store"
)

// CallbackHandler receives async events POSTed by the Python engine service.
type CallbackHandler struct {
	broker *sse.Broker
}

func NewCallbackHandler(broker *sse.Broker) *CallbackHandler {
	return &CallbackHandler{broker: broker}
}

type callbackEvent struct {
	Type string          `json:"type"` // agent_log | status
	Data json.RawMessage `json:"data"`
}

type agentLogData struct {
	IncidentID string `json:"incident_id"`
	StepName   string `json:"step_name"`
	Status     string `json:"status"` // running | done | error
	Detail     string `json:"detail"`
}

type statusData struct {
	IncidentID string `json:"incident_id"`
	Status     string `json:"status"` // processing | awaiting_approval | resolved | failed
}

// Handle processes a single event from the Python engine service.
func (h *CallbackHandler) Handle(c *gin.Context) {
	var ev callbackEvent
	if err := c.ShouldBindJSON(&ev); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	switch ev.Type {
	case "agent_log":
		var d agentLogData
		if err := json.Unmarshal(ev.Data, &d); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad agent_log payload"})
			return
		}

		logEntry, err := store.AppendAgentLog(ctx, d.IncidentID, d.StepName, d.Status, d.Detail)
		if err != nil {
			// Store write failed — still publish to SSE so UI stays live.
			h.broker.Publish(d.IncidentID, sse.Event{
				Type: "agent_log",
				Data: map[string]string{
					"incident_id": d.IncidentID,
					"step_name":   d.StepName,
					"status":      d.Status,
					"detail":      d.Detail,
				},
			})
		} else {
			h.broker.Publish(d.IncidentID, sse.Event{Type: "agent_log", Data: logEntry})
		}

	case "status":
		var d statusData
		if err := json.Unmarshal(ev.Data, &d); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad status payload"})
			return
		}

		status := models.IncidentStatus(d.Status)
		_ = store.UpdateIncidentStatus(ctx, d.IncidentID, status)

		h.broker.Publish(d.IncidentID, sse.Event{
			Type: "status",
			Data: map[string]string{"status": d.Status},
		})

		if status == models.StatusResolved || status == models.StatusFailed {
			h.broker.PublishDone(d.IncidentID)
		}
	}

	c.Status(http.StatusOK)
}
