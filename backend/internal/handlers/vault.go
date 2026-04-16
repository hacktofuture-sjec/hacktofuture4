package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rekall/backend/internal/vault"
)

// ListVault returns paginated vault entries, optionally filtered by source.
func ListVault(c *gin.Context) {
	source := c.Query("source") // human | synthetic | ""
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit < 1 || limit > 500 {
		limit = 100
	}

	var src *string
	if source != "" {
		src = &source
	}

	entries, err := vault.ListAll(src, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"entries": entries, "limit": limit, "offset": offset})
}

// VaultStats returns aggregate statistics for the vault.
func VaultStats(c *gin.Context) {
	stats, err := vault.Stats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}
