package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger returns a Gin middleware that prints structured request logs.
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method

		color := statusColor(status)
		reset := "\033[0m"

		fmt.Printf("[REKALL] %s %s%d%s %-7s %s %s\n",
			start.Format("15:04:05"),
			color, status, reset,
			method, path,
			latency,
		)
	}
}

func statusColor(code int) string {
	switch {
	case code >= 500:
		return "\033[31m" // red
	case code >= 400:
		return "\033[33m" // yellow
	case code >= 200:
		return "\033[32m" // green
	default:
		return "\033[0m"
	}
}
