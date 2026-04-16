import type { AgentStatus } from "@/types/blue.types";

interface StatusBarProps {
  status: AgentStatus | null;
  accent?: string;
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#8b949e", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

export function StatusBar({ status, accent = "#58a6ff" }: StatusBarProps) {
  if (!status) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "10px 16px",
        background: "#161b22",
        borderRadius: 8,
        border: `1px solid ${accent}33`,
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <StatBox label="Detections" value={status.detection_count} color="#f0883e" />
      <StatBox label="Responses" value={status.response_count} color="#3fb950" />
      <StatBox label="Patches" value={status.patch_count} color="#a371f7" />
      <StatBox label="CVE Fixes" value={status.cve_fix_count} color="#f85149" />
      <StatBox label="Isolations" value={status.isolation_count} color="#d29922" />
      <StatBox label="Assets" value={status.assets_discovered} color={accent} />
      <StatBox label="Vulnerable" value={status.vulnerable_assets} color="#f85149" />
      <StatBox label="CVEs Found" value={status.total_vulnerabilities} color="#f0883e" />
      <StatBox label="Env Alerts" value={status.environment_alerts} color="#d29922" />
      <StatBox label="Scans" value={status.scan_cycles} color="#7ee787" />
      <StatBox label="Evolutions" value={status.evolution_rounds} color="#a371f7" />
    </div>
  );
}
