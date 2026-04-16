import type { ScanStats } from "@/types/blue.types";

interface ScanPanelProps {
  stats: ScanStats | null;
  accent?: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: "#f85149",
  high: "#f0883e",
  medium: "#d29922",
  low: "#8b949e",
};

export function ScanPanel({ stats, accent = "#58a6ff" }: ScanPanelProps) {
  if (!stats) {
    return (
      <section style={sectionStyle(accent)}>
        <Header accent={accent} title="ASSET SCANNER" sub="waiting..." />
        <p style={{ color: "#8b949e", fontSize: 12 }}>Scanner initializing...</p>
      </section>
    );
  }

  return (
    <section style={sectionStyle(accent)}>
      <Header accent={accent} title="ASSET SCANNER" sub={`cycle #${stats.scan_count}`} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <MiniStat label="Total Assets" value={stats.total_assets} color={accent} />
        <MiniStat label="Vulnerable" value={stats.vulnerable_assets} color="#f85149" />
        <MiniStat label="Unique CVEs" value={stats.unique_cves_found} color="#f0883e" />
        <MiniStat label="Interval" value={`${stats.scan_interval.toFixed(1)}s`} color="#7ee787" />
      </div>

      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>BY ENVIRONMENT</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {Object.entries(stats.by_environment).map(([env, count]) => (
          <EnvBadge key={env} env={env} count={count} />
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>BY SEVERITY</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(stats.by_severity)
          .filter(([, count]) => count > 0)
          .map(([sev, count]) => (
            <span
              key={sev}
              style={{
                background: SEV_COLORS[sev] ?? "#8b949e",
                color: "#0d1117",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {sev}: {count}
            </span>
          ))}
      </div>
    </section>
  );
}

function Header({ accent, title, sub }: { accent: string; title: string; sub: string }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${accent}33`,
      }}
    >
      <h3 style={{ margin: 0, color: accent, fontSize: 14, letterSpacing: 1 }}>{title}</h3>
      <span style={{ color: "#8b949e", fontSize: 12 }}>{sub}</span>
    </header>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function EnvBadge({ env, count }: { env: string; count: number }) {
  const colors: Record<string, string> = {
    cloud: "#58a6ff",
    onprem: "#7ee787",
    hybrid: "#d29922",
  };
  return (
    <span
      style={{
        background: `${colors[env] ?? "#8b949e"}22`,
        color: colors[env] ?? "#8b949e",
        border: `1px solid ${colors[env] ?? "#8b949e"}55`,
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {env}: {count}
    </span>
  );
}

function sectionStyle(accent: string): React.CSSProperties {
  return {
    background: "#0d1117",
    borderRadius: 8,
    padding: 12,
    border: `1px solid ${accent}55`,
    height: "100%",
    overflowY: "auto",
  };
}
