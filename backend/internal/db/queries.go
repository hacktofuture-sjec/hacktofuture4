package db

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rekall/backend/internal/models"
)

// ─────────────────────────────────────────────
// Incidents
// ─────────────────────────────────────────────

func CreateIncident(ctx context.Context, source, failureType string, rawPayload map[string]any) (*models.Incident, error) {
	payload, err := json.Marshal(rawPayload)
	if err != nil {
		return nil, err
	}
	id := uuid.New().String()
	row := Pool.QueryRow(ctx, `
		INSERT INTO incidents (id, source, failure_type, raw_payload)
		VALUES ($1, $2, $3, $4)
		RETURNING id, source, failure_type, raw_payload, status, created_at, updated_at`,
		id, source, failureType, string(payload),
	)
	return scanIncident(row)
}

func GetIncident(ctx context.Context, id string) (*models.Incident, error) {
	row := Pool.QueryRow(ctx, `
		SELECT id, source, failure_type, raw_payload, status, created_at, updated_at
		FROM incidents WHERE id = $1`, id)
	inc, err := scanIncident(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return inc, err
}

func ListIncidents(ctx context.Context, limit, offset int) ([]*models.Incident, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, source, failure_type, raw_payload, status, created_at, updated_at
		FROM incidents ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.Incident
	for rows.Next() {
		inc, err := scanIncident(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, inc)
	}
	return result, rows.Err()
}

func CountIncidents(ctx context.Context) (int, error) {
	var n int
	err := Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM incidents`).Scan(&n)
	return n, err
}

func UpdateIncidentStatus(ctx context.Context, id string, status models.IncidentStatus) error {
	_, err := Pool.Exec(ctx, `
		UPDATE incidents SET status=$1, updated_at=NOW() WHERE id=$2`, string(status), id)
	return err
}

func scanIncident(row pgx.Row) (*models.Incident, error) {
	var inc models.Incident
	var rawJSON string
	err := row.Scan(
		&inc.ID, &inc.Source, &inc.FailureType, &rawJSON,
		&inc.Status, &inc.CreatedAt, &inc.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(rawJSON), &inc.RawPayload); err != nil {
		inc.RawPayload = map[string]any{}
	}
	return &inc, nil
}

// ─────────────────────────────────────────────
// Diagnostic bundles
// ─────────────────────────────────────────────

func CreateDiagnosticBundle(ctx context.Context, b *models.DiagnosticBundle) (*models.DiagnosticBundle, error) {
	b.ID = uuid.New().String()
	row := Pool.QueryRow(ctx, `
		INSERT INTO diagnostic_bundles
		  (id, incident_id, failure_signature, log_excerpt, git_diff, test_report, context_summary)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, incident_id, failure_signature, log_excerpt, git_diff, test_report, context_summary, created_at`,
		b.ID, b.IncidentID, b.FailureSignature, b.LogExcerpt, b.GitDiff, b.TestReport, b.ContextSummary,
	)
	return scanDiagnosticBundle(row)
}

func GetDiagnosticBundle(ctx context.Context, incidentID string) (*models.DiagnosticBundle, error) {
	row := Pool.QueryRow(ctx, `
		SELECT id, incident_id, failure_signature, log_excerpt, git_diff, test_report, context_summary, created_at
		FROM diagnostic_bundles WHERE incident_id=$1`, incidentID)
	b, err := scanDiagnosticBundle(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return b, err
}

func scanDiagnosticBundle(row pgx.Row) (*models.DiagnosticBundle, error) {
	var b models.DiagnosticBundle
	err := row.Scan(&b.ID, &b.IncidentID, &b.FailureSignature,
		&b.LogExcerpt, &b.GitDiff, &b.TestReport, &b.ContextSummary, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ─────────────────────────────────────────────
// Fix proposals
// ─────────────────────────────────────────────

func CreateFixProposal(ctx context.Context, p *models.FixProposal) (*models.FixProposal, error) {
	p.ID = uuid.New().String()
	cmds, _ := json.Marshal(p.FixCommands)

	// Default empty JSONB arrays if nil
	skipped := p.SkippedFixes
	if skipped == nil {
		skipped = []byte("[]")
	}
	trace := p.RLMTrace
	if trace == nil {
		trace = []byte("[]")
	}

	row := Pool.QueryRow(ctx, `
		INSERT INTO fix_proposals
		  (id, incident_id, tier, vault_entry_id, similarity_score,
		   fix_description, fix_commands, fix_diff, confidence,
		   reward_score, reasoning, skipped_fixes, rlm_trace)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING id, incident_id, tier, vault_entry_id, similarity_score,
		          fix_description, fix_commands, fix_diff, confidence,
		          reward_score, reasoning, skipped_fixes, rlm_trace, created_at`,
		p.ID, p.IncidentID, string(p.Tier), p.VaultEntryID, p.SimilarityScore,
		p.FixDescription, string(cmds), p.FixDiff, p.Confidence,
		p.RewardScore, p.Reasoning, string(skipped), string(trace),
	)
	return scanFixProposal(row)
}

func GetLatestFixProposal(ctx context.Context, incidentID string) (*models.FixProposal, error) {
	row := Pool.QueryRow(ctx, `
		SELECT id, incident_id, tier, vault_entry_id, similarity_score,
		       fix_description, fix_commands, fix_diff, confidence,
		       reward_score, reasoning, skipped_fixes, rlm_trace, created_at
		FROM fix_proposals WHERE incident_id=$1 ORDER BY created_at DESC LIMIT 1`, incidentID)
	p, err := scanFixProposal(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func scanFixProposal(row pgx.Row) (*models.FixProposal, error) {
	var p models.FixProposal
	var tier string
	var cmdsJSON, skippedJSON, traceJSON string
	err := row.Scan(
		&p.ID, &p.IncidentID, &tier, &p.VaultEntryID, &p.SimilarityScore,
		&p.FixDescription, &cmdsJSON, &p.FixDiff, &p.Confidence,
		&p.RewardScore, &p.Reasoning, &skippedJSON, &traceJSON, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.Tier = models.FixTier(tier)
	_ = json.Unmarshal([]byte(cmdsJSON), &p.FixCommands)
	if p.FixCommands == nil {
		p.FixCommands = []string{}
	}
	p.SkippedFixes = []byte(skippedJSON)
	p.RLMTrace = []byte(traceJSON)
	return &p, nil
}

// ─────────────────────────────────────────────
// Governance decisions
// ─────────────────────────────────────────────

func CreateGovernanceDecision(ctx context.Context, d *models.GovernanceDecision) (*models.GovernanceDecision, error) {
	d.ID = uuid.New().String()
	factors, _ := json.Marshal(d.RiskFactors)
	row := Pool.QueryRow(ctx, `
		INSERT INTO governance_decisions (id, incident_id, risk_score, decision, risk_factors)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, incident_id, risk_score, decision, risk_factors, created_at`,
		d.ID, d.IncidentID, d.RiskScore, string(d.Decision), string(factors),
	)
	return scanGovernance(row)
}

func GetLatestGovernanceDecision(ctx context.Context, incidentID string) (*models.GovernanceDecision, error) {
	row := Pool.QueryRow(ctx, `
		SELECT id, incident_id, risk_score, decision, risk_factors, created_at
		FROM governance_decisions WHERE incident_id=$1 ORDER BY created_at DESC LIMIT 1`, incidentID)
	d, err := scanGovernance(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return d, err
}

func scanGovernance(row pgx.Row) (*models.GovernanceDecision, error) {
	var d models.GovernanceDecision
	var decision, factorsJSON string
	err := row.Scan(&d.ID, &d.IncidentID, &d.RiskScore, &decision, &factorsJSON, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	d.Decision = models.GovernanceDecisionType(decision)
	_ = json.Unmarshal([]byte(factorsJSON), &d.RiskFactors)
	if d.RiskFactors == nil {
		d.RiskFactors = []string{}
	}
	return &d, nil
}

// ─────────────────────────────────────────────
// Agent logs
// ─────────────────────────────────────────────

func AppendAgentLog(ctx context.Context, incidentID, stepName, status, detail string) (*models.AgentLog, error) {
	id := uuid.New().String()
	row := Pool.QueryRow(ctx, `
		INSERT INTO agent_logs (id, incident_id, step_name, status, detail)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, incident_id, step_name, status, detail, created_at`,
		id, incidentID, stepName, status, detail,
	)
	var l models.AgentLog
	err := row.Scan(&l.ID, &l.IncidentID, &l.StepName, &l.Status, &l.Detail, &l.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func GetAgentLogs(ctx context.Context, incidentID string) ([]models.AgentLog, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, incident_id, step_name, status, detail, created_at
		FROM agent_logs WHERE incident_id=$1 ORDER BY created_at ASC`, incidentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AgentLog
	for rows.Next() {
		var l models.AgentLog
		if err := rows.Scan(&l.ID, &l.IncidentID, &l.StepName, &l.Status, &l.Detail, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []models.AgentLog{}
	}
	return logs, rows.Err()
}

// ─────────────────────────────────────────────
// RL episodes
// ─────────────────────────────────────────────

func CreateRLEpisode(ctx context.Context, ep *models.RLEpisode) (*models.RLEpisode, error) {
	ep.ID = uuid.New().String()
	row := Pool.QueryRow(ctx, `
		INSERT INTO rl_episodes (id, incident_id, fix_tier, outcome, reward, cumulative_reward)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, incident_id, fix_tier, outcome, reward, cumulative_reward, created_at`,
		ep.ID, ep.IncidentID, ep.FixTier, ep.Outcome, ep.Reward, ep.CumulativeReward,
	)
	var out models.RLEpisode
	err := row.Scan(&out.ID, &out.IncidentID, &out.FixTier, &out.Outcome,
		&out.Reward, &out.CumulativeReward, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func ListRLEpisodes(ctx context.Context, limit int) ([]models.RLEpisode, error) {
	rows, err := Pool.Query(ctx, `
		SELECT id, incident_id, fix_tier, outcome, reward, cumulative_reward, created_at
		FROM rl_episodes ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var episodes []models.RLEpisode
	for rows.Next() {
		var ep models.RLEpisode
		if err := rows.Scan(&ep.ID, &ep.IncidentID, &ep.FixTier, &ep.Outcome,
			&ep.Reward, &ep.CumulativeReward, &ep.CreatedAt); err != nil {
			return nil, err
		}
		episodes = append(episodes, ep)
	}
	if episodes == nil {
		episodes = []models.RLEpisode{}
	}
	return episodes, rows.Err()
}

// ─────────────────────────────────────────────
// Vault entries
// ─────────────────────────────────────────────

func ListVaultEntries(ctx context.Context, source *string, limit, offset int) ([]models.VaultEntry, error) {
	var rows pgx.Rows
	var err error

	cols := `id, chroma_id, failure_type, fix_description, source,
	         confidence, reward_score, retrieval_count, success_count, created_at, updated_at`

	if source != nil {
		rows, err = Pool.Query(ctx, `
			SELECT `+cols+`
			FROM vault_entries WHERE source=$1
			ORDER BY reward_score DESC, confidence DESC LIMIT $2 OFFSET $3`,
			*source, limit, offset,
		)
	} else {
		rows, err = Pool.Query(ctx, `
			SELECT `+cols+`
			FROM vault_entries
			ORDER BY reward_score DESC, confidence DESC LIMIT $1 OFFSET $2`,
			limit, offset,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.VaultEntry
	for rows.Next() {
		e, err := scanVaultEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, *e)
	}
	if entries == nil {
		entries = []models.VaultEntry{}
	}
	return entries, rows.Err()
}

func GetVaultStats(ctx context.Context) (*models.VaultStats, error) {
	row := Pool.QueryRow(ctx, `
		SELECT
		  COUNT(*)::int,
		  COUNT(*) FILTER (WHERE source='human')::int,
		  COUNT(*) FILTER (WHERE source='synthetic')::int,
		  AVG(confidence)
		FROM vault_entries`)
	var stats models.VaultStats
	err := row.Scan(&stats.Total, &stats.HumanCount, &stats.SyntheticCount, &stats.AvgConfidence)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

func GetMetricsSummary(ctx context.Context) (*models.MetricsSummary, error) {
	row := Pool.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*)::int FROM incidents)                        AS total_incidents,
		  (SELECT COUNT(*)::int FROM incidents WHERE status='resolved') AS resolved_count,
		  (SELECT COUNT(*)::int FROM vault_entries)                    AS vault_size,
		  (SELECT AVG(confidence) FROM vault_entries)                  AS avg_confidence,
		  (SELECT SUM(reward) FROM rl_episodes)                        AS total_reward`)
	var m models.MetricsSummary
	err := row.Scan(&m.TotalIncidents, &m.ResolvedCount, &m.VaultSize,
		&m.AvgConfidence, &m.TotalReward)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// UpsertVaultEntry inserts or updates a vault entry (keyed on chroma_id).
func UpsertVaultEntry(ctx context.Context, chromaID, source string, failureType, fixDesc *string, confidence float64) (*models.VaultEntry, error) {
	id := uuid.New().String()
	row := Pool.QueryRow(ctx, `
		INSERT INTO vault_entries (id, chroma_id, source, failure_type, fix_description, confidence)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (chroma_id) DO UPDATE
		  SET confidence=$6, updated_at=NOW()
		RETURNING id, chroma_id, failure_type, fix_description, source,
		          confidence, reward_score, retrieval_count, success_count, created_at, updated_at`,
		id, chromaID, source, failureType, fixDesc, confidence,
	)
	return scanVaultEntry(row)
}

// UpdateVaultRewardScore applies a reward delta to a vault entry's reward_score.
// Called by LearningAgent after each fix outcome.
func UpdateVaultRewardScore(ctx context.Context, vaultEntryID string, delta float64, success bool) error {
	successInc := 0
	if success {
		successInc = 1
	}
	_, err := Pool.Exec(ctx, `
		UPDATE vault_entries
		SET
		  reward_score    = reward_score + $1,
		  retrieval_count = retrieval_count + 1,
		  success_count   = success_count + $2,
		  updated_at      = NOW()
		WHERE id = $3`,
		delta, successInc, vaultEntryID,
	)
	return err
}

func scanVaultEntry(row pgx.Row) (*models.VaultEntry, error) {
	var e models.VaultEntry
	err := row.Scan(
		&e.ID, &e.ChromaID, &e.FailureType, &e.FixDescription,
		&e.Source, &e.Confidence, &e.RewardScore,
		&e.RetrievalCount, &e.SuccessCount, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// CountVaultEntries returns the total number of vault entries (for pagination).
func CountVaultEntries(ctx context.Context, source *string) (int, error) {
	var n int
	var err error
	if source != nil {
		err = Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM vault_entries WHERE source=$1`, *source).Scan(&n)
	} else {
		err = Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM vault_entries`).Scan(&n)
	}
	return n, err
}

