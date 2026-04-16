package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/store"
	"github.com/rekall/backend/internal/vault"
)

// Summary returns headline dashboard metrics.
func Summary(c *gin.Context) {
	stats, _ := vault.Stats()
	vaultSize := 0
	var avgConf *float64
	if stats != nil {
		vaultSize = stats.Total
		avgConf = stats.AvgConfidence
	}

	m, err := store.GetMetricsSummary(c.Request.Context(), vaultSize, avgConf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, m)
}

// Episodes returns the last N RL episodes from vault/episodes.json.
func Episodes(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit < 1 || limit > 500 {
		limit = 100
	}
	episodes, err := vault.ListEpisodes(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"episodes": episodes, "total": len(episodes)})
}
