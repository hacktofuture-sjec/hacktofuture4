// Shared TypeScript types — mirrors backend dataclasses

export type IncidentStatus =
  | "processing"
  | "awaiting_approval"
  | "resolved"
  | "failed";

export type FailureType =
  | "test"
  | "deploy"
  | "infra"
  | "security"
  | "oom"
  | "unknown";

export type FixTier = "T1_human" | "T2_synthetic" | "T3_llm";

export type GovernanceDecisionType =
  | "auto_apply"
  | "create_pr"
  | "block_await_human";

export type AgentStepStatus = "running" | "done" | "error";

export interface Incident {
  id: string;
  source: string;
  failure_type: FailureType;
  raw_payload: Record<string, unknown>;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticBundle {
  id: string;
  incident_id: string;
  failure_signature: string;
  log_excerpt: string | null;
  git_diff: string | null;
  test_report: string | null;
  context_summary: string | null;
  created_at: string;
}

export interface SkippedFix {
  vault_entry_id: string;
  fix_description: string;
  reward_score: number;
  confidence: number;
  reason: string; // e.g. "reward_below_threshold"
}

export interface RLMTraceEntry {
  depth: number;        // 0 = hotspot scan, 1 = deep investigation
  hotspot: string;      // log region examined
  finding: string;      // what the model found
  confidence: number;
}

export interface FixProposal {
  id: string;
  incident_id: string;
  tier: FixTier;
  vault_entry_id: string | null;
  similarity_score: number | null;
  fix_description: string;
  fix_commands: string[];
  fix_diff: string | null;
  confidence: number;
  reward_score?: number;
  reasoning?: string;
  skipped_fixes?: SkippedFix[];
  rlm_trace?: RLMTraceEntry[];
  created_at: string;
}

export interface GovernanceDecision {
  id: string;
  incident_id: string;
  risk_score: number;
  decision: GovernanceDecisionType;
  risk_factors: string[];
  created_at: string;
}

export interface AgentLog {
  id: string;
  incident_id: string;
  step_name: string;
  status: AgentStepStatus;
  detail: string;
  created_at: string;
}

export interface VaultEntry {
  id: string;
  chroma_id: string;
  failure_type: string | null;
  fix_description: string | null;
  source: "human" | "synthetic";
  confidence: number;
  reward_score: number;
  retrieval_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export interface RLEpisode {
  id: string;
  incident_id: string;
  fix_tier: string | null;
  outcome: string | null;
  reward: number;
  cumulative_reward: number;
  created_at: string;
}

export interface MetricsSummary {
  total_incidents: number;
  resolved_count: number;
  vault_size: number;
  avg_confidence: number | null;
  total_reward: number | null;
}
