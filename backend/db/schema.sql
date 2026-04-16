-- REKALL — PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core incidents
CREATE TABLE IF NOT EXISTS incidents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      TEXT NOT NULL,                          -- github_actions | gitlab | jenkins | simulator
    failure_type TEXT NOT NULL,                         -- test | deploy | infra | security | oom | unknown
    raw_payload JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'processing',     -- processing | awaiting_approval | resolved | failed
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Diagnostic context per incident
CREATE TABLE IF NOT EXISTS diagnostic_bundles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id       UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    failure_signature TEXT NOT NULL,
    log_excerpt       TEXT,
    git_diff          TEXT,
    test_report       TEXT,
    context_summary   TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix proposals
CREATE TABLE IF NOT EXISTS fix_proposals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id      UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    tier             TEXT NOT NULL,    -- T1_human | T2_synthetic | T3_llm
    vault_entry_id   UUID,
    similarity_score FLOAT,
    fix_description  TEXT NOT NULL,
    fix_commands     JSONB NOT NULL DEFAULT '[]',
    fix_diff         TEXT,
    confidence       FLOAT NOT NULL DEFAULT 0.5,
    reward_score     FLOAT NOT NULL DEFAULT 0.0,   -- vault entry reward at time of selection
    reasoning        TEXT,                          -- RLM Depth-1 reasoning trace (text)
    skipped_fixes    JSONB NOT NULL DEFAULT '[]',   -- fixes ranked below threshold (RL story)
    rlm_trace        JSONB NOT NULL DEFAULT '[]',   -- Depth-0/1 scan trace for UI
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Governance decisions
CREATE TABLE IF NOT EXISTS governance_decisions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    risk_score   FLOAT NOT NULL,
    decision     TEXT NOT NULL,   -- auto_apply | create_pr | block_await_human
    risk_factors JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent execution log (SSE-streamed to dashboard)
CREATE TABLE IF NOT EXISTS agent_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    step_name   TEXT NOT NULL,
    status      TEXT NOT NULL,   -- running | done | error
    detail      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RL episode tracking
CREATE TABLE IF NOT EXISTS rl_episodes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id       UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    fix_tier          TEXT,
    outcome           TEXT,        -- success | failure | rejected
    reward            FLOAT,
    cumulative_reward FLOAT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vault metadata mirror (vector data lives in ChromaDB)
CREATE TABLE IF NOT EXISTS vault_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chroma_id       TEXT UNIQUE NOT NULL,
    failure_type    TEXT,
    fix_description TEXT,
    source          TEXT NOT NULL,    -- human | synthetic
    confidence      FLOAT NOT NULL DEFAULT 0.80,
    reward_score    FLOAT NOT NULL DEFAULT 0.00,  -- running RL reward (±1.0 per outcome)
    retrieval_count INT   NOT NULL DEFAULT 0,
    success_count   INT   NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status      ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created     ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_incident   ON agent_logs(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rl_episodes_incident  ON rl_episodes(incident_id);
CREATE INDEX IF NOT EXISTS idx_vault_source          ON vault_entries(source);
