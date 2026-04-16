export type IncidentStatus =
  | "open"
  | "diagnosing"
  | "planned"
  | "pending_approval"
  | "executing"
  | "verifying"
  | "resolved"
  | "failed";

export type FailureClass =
  | "resource_exhaustion"
  | "application_crash"
  | "config_error"
  | "infra_saturation"
  | "dependency_failure"
  | "unknown";

export type RiskLevel = "low" | "medium" | "high";
export type DiagnosisMode = "rule" | "ai";
export type Severity = "low" | "medium" | "high" | "critical";

export interface MetricSummary {
  cpu: string;
  memory: string;
  restarts: number;
  latency_delta: string;
}

export interface EventRecord {
  reason: string;
  message: string;
  count: number;
  first_seen: string | null;
  last_seen: string | null;
  pod: string;
  namespace: string;
  type: string;
}

export interface LogSignature {
  signature: string;
  count: number;
}

export interface TraceSummary {
  enabled: boolean;
  suspected_path: string;
  hot_span: string;
  p95_ms: number;
}

export interface IncidentSnapshot {
  incident_id: string;
  alert: string;
  service: string;
  pod: string;
  metrics: MetricSummary;
  events: EventRecord[];
  logs_summary: LogSignature[];
  trace_summary: TraceSummary | null;
  scope: { namespace: string; deployment: string };
  monitor_confidence: number;
  failure_class: FailureClass;
  dependency_graph_summary: string;
}

export interface StructuredReasoning {
  matched_rules: string[];
  conflicting_signals: string[];
  missing_signals: string[];
}

export interface DiagnosisPayload {
  root_cause: string;
  confidence: number;
  diagnosis_mode: DiagnosisMode;
  fingerprint_matched: boolean;
  estimated_token_cost: number;
  actual_token_cost: number;
  affected_services: string[];
  evidence: string[];
  structured_reasoning: StructuredReasoning;
}

export interface SimulationResult {
  blast_radius_score: number;
  rollback_ready: boolean;
  dependency_impact: "none" | "limited" | "broad";
  policy_violations: string[];
}

export interface PlannerAction {
  action: string;
  description: string;
  risk_level: RiskLevel;
  expected_outcome: string;
  confidence: number;
  approval_required: boolean;
  estimated_token_cost: number;
  actual_token_cost: number;
  simulation_result: SimulationResult;
}

export interface PlannerOutput {
  actions: PlannerAction[];
}

export interface ExecutorResult {
  action: string;
  status: "success" | "sandbox_failed" | "production_failed" | "failed";
  sandbox_validated: boolean;
  rollback_needed: boolean;
  execution_timestamp: string | null;
  error: string | null;
}

export interface ThresholdCheck {
  metric: string;
  threshold: number;
  observed: number;
  passed: boolean;
}

export interface VerificationOutput {
  verification_window_seconds: number;
  thresholds_checked: ThresholdCheck[];
  recovered: boolean;
  close_reason: string;
}

export interface TokenSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_ai_calls: number;
  total_actual_cost_usd: number;
  rule_only_resolution: boolean;
  fallback_triggered: boolean;
}

export interface IncidentListItem {
  incident_id: string;
  status: IncidentStatus;
  service: string;
  failure_class: FailureClass;
  severity: Severity;
  monitor_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface IncidentDetail extends IncidentListItem {
  namespace: string;
  pod: string;
  scenario_id: string | null;
  snapshot: IncidentSnapshot;
  diagnosis: DiagnosisPayload | null;
  plan: PlannerOutput | null;
  execution: ExecutorResult | null;
  verification: VerificationOutput | null;
  token_summary: TokenSummary | null;
  resolved_at: string | null;
}

export interface TimelineEvent {
  timestamp: string;
  status: IncidentStatus;
  actor: string;
  note: string;
}

export interface CostReport {
  incident_id?: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_ai_calls: number;
  total_actual_cost_usd: number;
}

export type WSMessage =
  | {
      type: "incident_event";
      incident_id: string;
      status: IncidentStatus;
      severity: Severity;
      created_at: string;
    }
  | {
      type: "status_change";
      incident_id: string;
      previous_status: IncidentStatus;
      new_status: IncidentStatus;
      timestamp: string;
    }
  | {
      type: "diagnosis_complete";
      incident_id: string;
      diagnosis: DiagnosisPayload;
    }
  | { type: "plan_ready"; incident_id: string; plan: PlannerOutput }
  | {
      type: "execution_update";
      incident_id: string;
      execution: ExecutorResult;
    }
  | {
      type: "incident_resolved";
      incident_id: string;
      verification: VerificationOutput;
      token_summary: TokenSummary;
    };
