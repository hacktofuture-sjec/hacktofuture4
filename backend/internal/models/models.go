package models

import "time"

// IncidentStatus represents the lifecycle state of an incident.
type IncidentStatus string

const (
	StatusProcessing       IncidentStatus = "processing"
	StatusAwaitingApproval IncidentStatus = "awaiting_approval"
	StatusResolved         IncidentStatus = "resolved"
	StatusFailed           IncidentStatus = "failed"
)

// FixTier identifies the retrieval tier used to source a fix.
type FixTier string

const (
	TierHuman     FixTier = "T1_human"
	TierSynthetic FixTier = "T2_synthetic"
	TierLLM       FixTier = "T3_llm"
)

// GovernanceDecisionType controls what action is taken with a fix.
type GovernanceDecisionType string

const (
	DecisionAutoApply       GovernanceDecisionType = "auto_apply"
	DecisionCreatePR        GovernanceDecisionType = "create_pr"
	DecisionBlockAwaitHuman GovernanceDecisionType = "block_await_human"
)

// Incident is the central record for a CI/CD failure event.
type Incident struct {
	ID          string            `json:"id"`
	Source      string            `json:"source"`
	FailureType string            `json:"failure_type"`
	RawPayload  map[string]any    `json:"raw_payload"`
	Status      IncidentStatus    `json:"status"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// DiagnosticBundle holds the context built by DiagnosticAgent.
type DiagnosticBundle struct {
	ID               string    `json:"id"`
	IncidentID       string    `json:"incident_id"`
	FailureSignature string    `json:"failure_signature"`
	LogExcerpt       *string   `json:"log_excerpt"`
	GitDiff          *string   `json:"git_diff"`
	TestReport       *string   `json:"test_report"`
	ContextSummary   *string   `json:"context_summary"`
	CreatedAt        time.Time `json:"created_at"`
}

// FixProposal is produced by FixAgent, indicating how to repair the failure.
type FixProposal struct {
	ID              string    `json:"id"`
	IncidentID      string    `json:"incident_id"`
	Tier            FixTier   `json:"tier"`
	VaultEntryID    *string   `json:"vault_entry_id"`
	SimilarityScore *float64  `json:"similarity_score"`
	FixDescription  string    `json:"fix_description"`
	FixCommands     []string  `json:"fix_commands"`
	FixDiff         *string   `json:"fix_diff"`
	Confidence      float64   `json:"confidence"`
	Reasoning       string    `json:"reasoning"`
	RLMTrace        []byte    `json:"rlm_trace,omitempty"`     // JSONB depth 0/1 scan trace
	CreatedAt       time.Time `json:"created_at"`
}

// GovernanceDecision is produced by GovernanceAgent.
type GovernanceDecision struct {
	ID          string                 `json:"id"`
	IncidentID  string                 `json:"incident_id"`
	RiskScore   float64                `json:"risk_score"`
	Decision    GovernanceDecisionType `json:"decision"`
	RiskFactors []string               `json:"risk_factors"`
	CreatedAt   time.Time              `json:"created_at"`
}

// AgentLog is a single step event emitted during pipeline execution.
type AgentLog struct {
	ID         string    `json:"id"`
	IncidentID string    `json:"incident_id"`
	StepName   string    `json:"step_name"`
	Status     string    `json:"status"` // running | done | error
	Detail     string    `json:"detail"`
	CreatedAt  time.Time `json:"created_at"`
}

// VaultEntry mirrors the flat-file vault JSON schema for the UI.
// No chromadb_id — keyed by failure_signature only.
type VaultEntry struct {
	ID               string    `json:"id"`
	FailureSignature string    `json:"failure_signature"`
	FailureType      *string   `json:"failure_type"`
	FixDescription   *string   `json:"fix_description"`
	Source           string    `json:"source"` // human | synthetic
	Confidence       float64   `json:"confidence"`
	RetrievalCount   int       `json:"retrieval_count"`
	SuccessCount     int       `json:"success_count"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// VaultStats aggregates vault summary metrics.
type VaultStats struct {
	Total          int      `json:"total"`
	HumanCount     int      `json:"human_count"`
	SyntheticCount int      `json:"synthetic_count"`
	AvgConfidence  *float64 `json:"avg_confidence"`
}

// MetricsSummary provides the dashboard headline figures.
type MetricsSummary struct {
	TotalIncidents int      `json:"total_incidents"`
	ResolvedCount  int      `json:"resolved_count"`
	VaultSize      int      `json:"vault_size"`
	AvgConfidence  *float64 `json:"avg_confidence"`
}

// --- Request / response DTOs ---

type SimulateRequest struct {
	Scenario string `json:"scenario" binding:"required"`
}

type ApprovalRequest struct {
	ReviewedBy string  `json:"reviewed_by"`
	Notes      *string `json:"notes"`
}

type GitHubWebhookPayload struct {
	Action      *string        `json:"action"`
	WorkflowRun *WorkflowRun   `json:"workflow_run"`
	Repository  map[string]any `json:"repository"`
}

type WorkflowRun struct {
	Name       string `json:"name"`
	Conclusion string `json:"conclusion"`
	HTMLURL    string `json:"html_url"`
}

type GitLabWebhookPayload struct {
	ObjectKind string `json:"object_kind"`
	Status     string `json:"status"`
}

type IncidentDetail struct {
	Incident           *Incident           `json:"incident"`
	DiagnosticBundle   *DiagnosticBundle   `json:"diagnostic_bundle"`
	FixProposal        *FixProposal        `json:"fix_proposal"`
	GovernanceDecision *GovernanceDecision `json:"governance_decision"`
	AgentLogs          []AgentLog          `json:"agent_logs"`
}
