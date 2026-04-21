export type ToolStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ToolCall {
  id: string;
  name: string;
  category: "defend" | "patch" | "strategy" | "scan" | "environment" | "evolution" | string;
  status: ToolStatus;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
}

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | string;
  message: string;
  tool_id: string | null;
}

export interface AssetInfo {
  asset_id: string;
  host: string;
  port: number;
  service: string;
  environment: "cloud" | "onprem" | "hybrid";
  layer: string;
  version: string | null;
  banner: string | null;
  detection_method: string | null;
  cve_count: number;
  cves: CVEInfo[];
  last_scanned: number | null;
  status: string;
}

export interface CVEInfo {
  cve_id: string;
  severity: "critical" | "high" | "medium" | "low";
  cvss_score: number;
  description: string;
  affected_software: string;
  affected_version: string;
  fix: string;
}

export interface EnvironmentAlert {
  alert_id: string;
  environment: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  resource: string;
  recommendation: string;
  timestamp: number;
}

export interface ScanStats {
  scan_count: number;
  total_assets: number;
  vulnerable_assets: number;
  total_vulnerabilities: number;
  by_environment: Record<string, number>;
  by_layer: Record<string, number>;
  by_severity: Record<string, number>;
  scan_interval: number;
  cve_lookups: number;
  unique_cves_found: number;
}

export interface EnvironmentStats {
  total_alerts: number;
  by_environment: Record<string, number>;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  monitoring_active: boolean;
}

export interface EvolutionMetrics {
  evolution_count: number;
  round_count: number;
  avg_response_time_ms: number;
  response_accuracy_pct: number;
  improvement_pct: number;
  current_params: Record<string, number>;
  top_attack_patterns: { pattern: string; count: number }[];
  total_patterns_tracked: number;
}

export interface AgentStatus {
  running: boolean;
  detection_count: number;
  response_count: number;
  patch_count: number;
  cve_fix_count: number;
  isolation_count: number;
  scan_cycles: number;
  assets_discovered: number;
  vulnerable_assets: number;
  total_vulnerabilities: number;
  environment_alerts: number;
  evolution_rounds: number;
  defense_plans: number;
}

export type WsEnvelope =
  | { type: "tool_call"; payload: ToolCall }
  | { type: "log"; payload: LogEntry }
  | { type: "agent_status"; payload: AgentStatus }
  | { type: "scan_stats"; payload: Record<string, unknown> }
  | { type: "heartbeat"; payload: Record<string, never> };

export interface SSHCredentials {
  host: string;
  ssh_port: number;
  username: string;
  password: string;
}

export interface SSHScanResult {
  success: boolean;
  host: string;
  error?: string;
  os_info?: string;
  listening_ports: { port: number; process: string }[];
  services: {
    software: string;
    version: string;
    raw_output: string;
    port: number | null;
    cve_count: number;
    cves: CVEInfo[];
    fixed: boolean;
    fix_output: string;
    proposed_fixes: string[];
  }[];
  total_services: number;
  total_cves: number;
  fixes_applied: number;
  elapsed_seconds: number;
}

export interface ClosePortRequest {
  host: string;
  port: number;
  protocol?: string;
}

export interface HardenServiceRequest {
  host: string;
  service: string;
  options?: Record<string, unknown>;
}

/* ── Red Report / Remediation ─────────────────────────────────── */

export interface RedReportRequest {
  target: string;
  risk_score: number;
  recon: Record<string, unknown>;
  exploit: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
}

export interface AppliedFix {
  fix_id: string;
  category: string;
  severity: string;
  status: string;
  details: string;
  steps_applied: number;
  endpoint?: string;
  [key: string]: unknown;
}

export interface RemediationResult {
  target: string;
  risk_score: number;
  total_findings: number;
  fixes_applied: number;
  total_steps: number;
  severity_counts: Record<string, number>;
  applied_fixes: AppliedFix[];
  status: string;
}

export interface RemediationStatus {
  findings_received: number;
  fixes_dispatched: number;
  total_steps: number;
  applied_fixes: AppliedFix[];
}
