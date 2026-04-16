// Package vault provides file-based reading of the REKALL flat-file vault.
// It is the Go side of the flat-file vault — read-only for the backend.
// All writes are done by the Python engine (rekall_engine/vault/store.py).
package vault

// ListEpisodes reads the last `limit` RL episodes from vault/episodes.json.

import (
	"encoding/json"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/rekall/backend/internal/models"
)

var (
	vaultPath string
	once      sync.Once
)

// Init sets the vault root directory. Call once at startup.
func Init(path string) {
	once.Do(func() { vaultPath = path })
}

// listEntries reads all *.json files from a scope directory.
func listEntries(scope string) ([]*models.VaultEntry, error) {
	dir := filepath.Join(vaultPath, scope)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*models.VaultEntry{}, nil
		}
		return nil, err
	}

	var result []*models.VaultEntry
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			log.Printf("[vault] read error %s: %v", e.Name(), err)
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal(data, &raw); err != nil {
			log.Printf("[vault] parse error %s: %v", e.Name(), err)
			continue
		}
		entry := mapToVaultEntry(raw)
		if entry != nil {
			result = append(result, entry)
		}
	}
	return result, nil
}

// ListAll returns all vault entries from local (and optionally org) sorted by confidence DESC.
func ListAll(source *string, limit, offset int) ([]*models.VaultEntry, error) {
	local, err := listEntries("local")
	if err != nil {
		return nil, err
	}
	org, _ := listEntries("org") // org vault is optional
	all := append(local, org...)

	// Filter by source if requested
	if source != nil && *source != "" {
		var filtered []*models.VaultEntry
		for _, e := range all {
			if e.Source == *source {
				filtered = append(filtered, e)
			}
		}
		all = filtered
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].Confidence > all[j].Confidence
	})

	if offset >= len(all) {
		return []*models.VaultEntry{}, nil
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	return all[offset:end], nil
}

// Stats computes aggregate vault statistics.
func Stats() (*models.VaultStats, error) {
	entries, err := ListAll(nil, math.MaxInt32, 0)
	if err != nil {
		return nil, err
	}

	humanCount := 0
	synthCount := 0
	totalConf := 0.0

	for _, e := range entries {
		if e.Source == "human" {
			humanCount++
		} else {
			synthCount++
		}
		totalConf += e.Confidence
	}

	var avgConf *float64
	if len(entries) > 0 {
		v := totalConf / float64(len(entries))
		avgConf = &v
	}

	return &models.VaultStats{
		Total:          len(entries),
		HumanCount:     humanCount,
		SyntheticCount: synthCount,
		AvgConfidence:  avgConf,
	}, nil
}

// mapToVaultEntry converts a raw JSON map to a VaultEntry.
func mapToVaultEntry(raw map[string]any) *models.VaultEntry {
	id, _ := raw["id"].(string)
	if id == "" {
		return nil
	}
	sig, _ := raw["failure_signature"].(string)
	ft, _ := raw["failure_type"].(string)
	desc, _ := raw["fix_description"].(string)
	src, _ := raw["source"].(string)
	if src == "" {
		src = "human"
	}

	conf := toFloat(raw["confidence"])
	retrieval := toInt(raw["retrieval_count"])
	success := toInt(raw["success_count"])

	createdAt := time.Now()
	updatedAt := time.Now()
	if s, ok := raw["created_at"].(string); ok {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			createdAt = t
		}
	}
	if s, ok := raw["updated_at"].(string); ok {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			updatedAt = t
		}
	}

	return &models.VaultEntry{
		ID:               id,
		FailureSignature: sig,
		FailureType:      &ft,
		FixDescription:   &desc,
		Source:           src,
		Confidence:       conf,
		RetrievalCount:   retrieval,
		SuccessCount:     success,
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
	}
}

func toFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		f, _ := strconv.ParseFloat(x, 64)
		return f
	}
	return 0
}

func toInt(v any) int {
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	}
	return 0
}

// ListEpisodes reads the last `limit` RL episodes from vault/episodes.json.
// Returns an empty slice if the file doesn't exist yet.
func ListEpisodes(limit int) ([]map[string]any, error) {
	path := filepath.Join(vaultPath, "episodes.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]any{}, nil
		}
		return nil, err
	}

	var all []map[string]any
	if err := json.Unmarshal(data, &all); err != nil {
		return nil, err
	}

	// Return the last `limit` episodes (most recent)
	if limit > 0 && len(all) > limit {
		all = all[len(all)-limit:]
	}
	return all, nil
}
