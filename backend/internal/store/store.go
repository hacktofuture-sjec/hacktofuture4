// Package store provides an in-memory data store for incidents, agent logs,
// fix proposals, and governance decisions. It replaces the PostgreSQL backend
// entirely — no database required. Data is keyed by incident UUID and held in
// memory for the lifetime of the process.
//
// Vault entries are NOT stored here; they are read directly from the flat-file
// vault on disk by the vault package.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rekall/backend/internal/models"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("not found")

// incidentRecord is the full in-memory record for one incident.
type incidentRecord struct {
	incident   *models.Incident
	bundle     *models.DiagnosticBundle
	fix        *models.FixProposal
	governance *models.GovernanceDecision
	sandbox    *models.SandboxResult
	logs       []models.AgentLog
}

var (
	mu      sync.RWMutex
	records = map[string]*incidentRecord{}
)

// SerializableRecord is used for JSON file persistence.
type SerializableRecord struct {
	Incident   *models.Incident           `json:"incident"`
	Bundle     *models.DiagnosticBundle   `json:"bundle"`
	Fix        *models.FixProposal        `json:"fix"`
	Governance *models.GovernanceDecision `json:"governance"`
	Sandbox    *models.SandboxResult      `json:"sandbox"`
	Logs       []models.AgentLog          `json:"logs"`
}

// Load reads incidents from incidents.json in the vault.
func Load(vaultPath string) error {
	bytes, err := os.ReadFile(filepath.Join(vaultPath, "incidents.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var data map[string]SerializableRecord
	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}
	mu.Lock()
	defer mu.Unlock()
	for k, v := range data {
		records[k] = &incidentRecord{
			incident:   v.Incident,
			bundle:     v.Bundle,
			fix:        v.Fix,
			governance: v.Governance,
			sandbox:    v.Sandbox,
			logs:       v.Logs,
		}
	}
	return nil
}

// Save writes incidents to incidents.json in the vault.
func Save(vaultPath string) error {
	mu.RLock()
	defer mu.RUnlock()
	data := make(map[string]SerializableRecord, len(records))
	for k, v := range records {
		data[k] = SerializableRecord{
			Incident:   v.incident,
			Bundle:     v.bundle,
			Fix:        v.fix,
			Governance: v.governance,
			Sandbox:    v.sandbox,
			Logs:       v.logs,
		}
	}
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(vaultPath, "incidents.json"), bytes, 0644)
}

// ── Incidents ──────────────────────────────────────────────────────────────────

// CreateIncident creates a new incident and stores it in memory.
func CreateIncident(_ context.Context, source, failureType string, payload map[string]any) (*models.Incident, error) {
	inc := &models.Incident{
		ID:          uuid.NewString(),
		Source:      source,
		FailureType: failureType,
		RawPayload:  payload,
		Status:      models.StatusProcessing,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	mu.Lock()
	records[inc.ID] = &incidentRecord{incident: inc, logs: []models.AgentLog{}}
	mu.Unlock()
	return inc, nil
}

// GetIncident fetches one incident by ID.
func GetIncident(_ context.Context, id string) (*models.Incident, error) {
	mu.RLock()
	rec, ok := records[id]
	mu.RUnlock()
	if !ok {
		return nil, nil // return nil, nil (not found) — matches old DB behaviour
	}
	return rec.incident, nil
}

// ListIncidents returns incidents sorted newest-first with limit/offset.
func ListIncidents(_ context.Context, limit, offset int) ([]*models.Incident, error) {
	mu.RLock()
	all := make([]*models.Incident, 0, len(records))
	for _, r := range records {
		all = append(all, r.incident)
	}
	mu.RUnlock()

	sort.Slice(all, func(i, j int) bool {
		return all[i].CreatedAt.After(all[j].CreatedAt)
	})

	if offset >= len(all) {
		return []*models.Incident{}, nil
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	return all[offset:end], nil
}

// UpdateIncidentStatus sets the status of an existing incident.
func UpdateIncidentStatus(_ context.Context, id string, status models.IncidentStatus) error {
	mu.Lock()
	defer mu.Unlock()
	rec, ok := records[id]
	if !ok {
		return ErrNotFound
	}
	rec.incident.Status = status
	rec.incident.UpdatedAt = time.Now().UTC()
	return nil
}

// ── Agent Logs ────────────────────────────────────────────────────────────────

// AppendAgentLog appends a pipeline step log entry for an incident.
func AppendAgentLog(_ context.Context, incidentID, stepName, status, detail string) (*models.AgentLog, error) {
	entry := models.AgentLog{
		ID:         uuid.NewString(),
		IncidentID: incidentID,
		StepName:   stepName,
		Status:     status,
		Detail:     detail,
		CreatedAt:  time.Now().UTC(),
	}
	mu.Lock()
	rec, ok := records[incidentID]
	if !ok {
		// Auto-create a minimal record so logs work even during races
		rec = &incidentRecord{
			incident: &models.Incident{ID: incidentID, Status: models.StatusProcessing, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
			logs:     []models.AgentLog{},
		}
		records[incidentID] = rec
	}
	rec.logs = append(rec.logs, entry)
	mu.Unlock()
	return &entry, nil
}

// GetAgentLogs returns all log entries for an incident.
func GetAgentLogs(_ context.Context, incidentID string) ([]models.AgentLog, error) {
	mu.RLock()
	rec, ok := records[incidentID]
	mu.RUnlock()
	if !ok {
		return []models.AgentLog{}, nil
	}
	out := make([]models.AgentLog, len(rec.logs))
	copy(out, rec.logs)
	return out, nil
}

// ── Fix Proposals ─────────────────────────────────────────────────────────────

// UpsertFixProposal stores (or replaces) the fix proposal for an incident.
func UpsertFixProposal(_ context.Context, fix *models.FixProposal) error {
	if fix.ID == "" {
		fix.ID = uuid.NewString()
	}
	fix.CreatedAt = time.Now().UTC()
	mu.Lock()
	defer mu.Unlock()
	rec, ok := records[fix.IncidentID]
	if !ok {
		return ErrNotFound
	}
	rec.fix = fix
	return nil
}

// GetLatestFixProposal returns the stored fix proposal for an incident.
func GetLatestFixProposal(_ context.Context, incidentID string) (*models.FixProposal, error) {
	mu.RLock()
	rec, ok := records[incidentID]
	mu.RUnlock()
	if !ok {
		return nil, nil
	}
	return rec.fix, nil
}

// ── Governance Decisions ──────────────────────────────────────────────────────

// UpsertGovernanceDecision stores the governance decision for an incident.
func UpsertGovernanceDecision(_ context.Context, gov *models.GovernanceDecision) error {
	if gov.ID == "" {
		gov.ID = uuid.NewString()
	}
	gov.CreatedAt = time.Now().UTC()
	mu.Lock()
	defer mu.Unlock()
	rec, ok := records[gov.IncidentID]
	if !ok {
		return ErrNotFound
	}
	rec.governance = gov
	return nil
}

// GetLatestGovernanceDecision returns the governance decision for an incident.
func GetLatestGovernanceDecision(_ context.Context, incidentID string) (*models.GovernanceDecision, error) {
	mu.RLock()
	rec, ok := records[incidentID]
	mu.RUnlock()
	if !ok {
		return nil, nil
	}
	return rec.governance, nil
}

// ── Diagnostic Bundles ────────────────────────────────────────────────────────

// UpsertDiagnosticBundle stores the diagnostic bundle for an incident.
func UpsertDiagnosticBundle(_ context.Context, b *models.DiagnosticBundle) error {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	b.CreatedAt = time.Now().UTC()
	mu.Lock()
	defer mu.Unlock()
	rec, ok := records[b.IncidentID]
	if !ok {
		return ErrNotFound
	}
	rec.bundle = b
	return nil
}

// GetDiagnosticBundle returns the diagnostic bundle for an incident.
func GetDiagnosticBundle(_ context.Context, incidentID string) (*models.DiagnosticBundle, error) {
	mu.RLock()
	rec, ok := records[incidentID]
	mu.RUnlock()
	if !ok {
		return nil, nil
	}
	return rec.bundle, nil
}

// ── Sandbox Results ───────────────────────────────────────────────────────────

// UpsertSandboxResult stores the Minikube sandbox result for an incident.
func UpsertSandboxResult(_ context.Context, r *models.SandboxResult) error {
	mu.Lock()
	defer mu.Unlock()
	rec, ok := records[r.IncidentID]
	if !ok {
		return ErrNotFound
	}
	rec.sandbox = r
	return nil
}

// GetSandboxResult returns the sandbox result for an incident (nil if not run).
func GetSandboxResult(_ context.Context, incidentID string) (*models.SandboxResult, error) {
	mu.RLock()
	rec, ok := records[incidentID]
	mu.RUnlock()
	if !ok {
		return nil, nil
	}
	return rec.sandbox, nil
}

// ── Metrics ───────────────────────────────────────────────────────────────────

// GetMetricsSummary computes live metrics from in-memory records.
func GetMetricsSummary(_ context.Context, vaultSize int, avgConfidence *float64) (*models.MetricsSummary, error) {
	mu.RLock()
	total := len(records)
	resolved := 0
	for _, r := range records {
		if r.incident.Status == models.StatusResolved {
			resolved++
		}
	}
	mu.RUnlock()

	return &models.MetricsSummary{
		TotalIncidents: total,
		ResolvedCount:  resolved,
		VaultSize:      vaultSize,
		AvgConfidence:  avgConfidence,
	}, nil
}
