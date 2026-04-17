package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/sse"
)

const keepaliveInterval = 15 * time.Second

// StreamHandler serves SSE streams for individual incidents.
type StreamHandler struct {
	broker *sse.Broker
}

func NewStreamHandler(broker *sse.Broker) *StreamHandler {
	return &StreamHandler{broker: broker}
}

// Stream opens an SSE connection and fans out agent log events for incidentID.
// The connection is held open until the pipeline completes (done event) or the
// client disconnects.
func (h *StreamHandler) Stream(c *gin.Context) {
	incidentID := c.Param("id")

	ch := h.broker.Subscribe(incidentID)
	defer h.broker.Unsubscribe(incidentID, ch)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()

	ticker := time.NewTicker(keepaliveInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return

		case <-ticker.C:
			// Heartbeat comment keeps the TCP connection alive through proxies
			fmt.Fprintf(c.Writer, ": heartbeat\n\n")
			c.Writer.Flush()

		case ev, ok := <-ch:
			if !ok {
				return
			}

			b, err := ev.Marshal()
			if err != nil {
				continue
			}

			if ev.Type == "done" {
				fmt.Fprintf(c.Writer, "event: done\ndata: {}\n\n")
				c.Writer.Flush()
				return
			}

			fmt.Fprintf(c.Writer, "data: %s\n\n", b)
			c.Writer.Flush()
		}
	}
}
