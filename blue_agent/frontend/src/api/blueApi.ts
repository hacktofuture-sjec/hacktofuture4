import axios from "axios";
import type {
  AssetInfo,
  ClosePortRequest,
  EnvironmentAlert,
  EnvironmentStats,
  EvolutionMetrics,
  HardenServiceRequest,
  RedReportRequest,
  RemediationResult,
  RemediationStatus,
  ScanStats,
  SSHCredentials,
  SSHScanResult,
  ToolCall,
} from "@/types/blue.types";

const BLUE_BASE_URL =
  import.meta.env.VITE_BLUE_API_URL ?? "http://localhost:8002";

const client = axios.create({
  baseURL: BLUE_BASE_URL,
  timeout: 120_000,  // 2 min — SSH scans can take time on real servers
});

export const blueApi = {
  health: () => client.get<{ status: string; agent: string }>("/health"),

  // Defense
  closePort: (req: ClosePortRequest) =>
    client.post("/defend/close_port", req).then((r) => r.data),
  hardenService: (req: HardenServiceRequest) =>
    client.post("/defend/harden_service", req).then((r) => r.data),
  isolateHost: (host: string, reason?: string) =>
    client.post("/defend/isolate_host", { host, reason }).then((r) => r.data),
  recentDefenses: (limit = 20) =>
    client
      .get<ToolCall[]>("/defend/recent", { params: { limit } })
      .then((r) => r.data),

  // Patching
  applyPatch: (host: string, cve_id?: string, pkg?: string) =>
    client
      .post("/patch/apply", { host, cve_id, package: pkg })
      .then((r) => r.data),
  verifyFix: (host: string, cve_id: string) =>
    client.post("/patch/verify_fix", { host, cve_id }).then((r) => r.data),

  // Strategy
  planDefense: (host: string, threat: Record<string, unknown> = {}) =>
    client.post("/strategy/plan", { host, threat }).then((r) => r.data),
  currentStrategy: () =>
    client.get("/strategy/current").then((r) => r.data),
  evolutionMetrics: () =>
    client.get<EvolutionMetrics>("/strategy/evolution").then((r) => r.data),
  agentStatus: () =>
    client.get("/strategy/status").then((r) => r.data),

  // Scanning
  assetInventory: (environment?: string) =>
    client
      .get<AssetInfo[]>("/scan/inventory", { params: environment ? { environment } : {} })
      .then((r) => r.data),
  vulnerableAssets: () =>
    client.get<AssetInfo[]>("/scan/vulnerable").then((r) => r.data),
  scanStats: () =>
    client.get<ScanStats>("/scan/stats").then((r) => r.data),
  allVulnerabilities: () =>
    client.get("/scan/vulnerabilities").then((r) => r.data),

  // Environment monitoring
  environmentAlerts: (environment?: string) =>
    client
      .get<EnvironmentAlert[]>("/environment/alerts", {
        params: environment ? { environment } : {},
      })
      .then((r) => r.data),
  environmentStats: () =>
    client.get<EnvironmentStats>("/environment/stats").then((r) => r.data),

  // SSH scanning (step 1: scan, step 2: apply fixes)
  sshScan: (creds: SSHCredentials) =>
    client.post<SSHScanResult>("/scan/ssh", creds).then((r) => r.data),
  sshApplyFixes: () =>
    client.post("/scan/ssh/apply-fixes").then((r) => r.data),
  sshScanResults: () =>
    client.get("/scan/ssh/results").then((r) => r.data),
  sshScanStats: () =>
    client.get("/scan/ssh/stats").then((r) => r.data),

  // Remediation — Red report ingestion
  ingestReport: (report: RedReportRequest) =>
    client.post<RemediationResult>("/remediate/ingest-report", report).then((r) => r.data),
  runSampleRemediation: () =>
    client.post<RemediationResult>("/remediate/run-sample").then((r) => r.data),
  remediationStatus: () =>
    client.get<RemediationStatus>("/remediate/status").then((r) => r.data),
};
