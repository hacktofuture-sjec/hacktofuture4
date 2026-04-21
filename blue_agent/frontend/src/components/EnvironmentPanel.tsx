import type { EnvironmentStats } from "@/types/blue.types";

interface EnvironmentPanelProps {
  stats: EnvironmentStats | null;
  accent?: string;
}

const ENV_COLORS: Record<string, string> = {
  cloud: "#58a6ff",
  onprem: "#7ee787",
  hybrid: "#d29922",
};

const SEV_COLORS: Record<string, string> = {
  critical: "#f85149",
  high: "#f0883e",
  medium: "#d29922",
  low: "#8b949e",
};

export function EnvironmentPanel({ stats, accent = "#58a6ff" }: EnvironmentPanelProps) {
  if (!stats) {
    return (
      <section style={sectionStyle(accent)}>
        <Header accent={accent} />
        <p style={{ color: "#8b949e", fontSize: 12 }}>Monitoring initializing...</p>
      </section>
    );
  }

  return (
    <section style={sectionStyle(accent)}>
      <Header accent={accent} />

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        {(["cloud", "onprem", "hybrid"] as const).map((env) => (
          <div
            key={env}
            style={{
              flex: 1,
              minWidth: 100,
              background: `${ENV_COLORS[env]}11`,
              border: `1px solid ${ENV_COLORS[env]}44`,
              borderRadius: 6,
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: ENV_COLORS[env], textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
              {env === "onprem" ? "ON-PREM" : env.toUpperCase()}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: ENV_COLORS[env] }}>
              {stats.by_environment[env] ?? 0}
            </div>
            <div style={{ fontSize: 9, color: "#8b949e" }}>alerts</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>ALERT SEVERITY</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
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

      {Object.keys(stats.by_category).length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>BY CATEGORY</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(stats.by_category).map(([cat, count]) => (
              <span
                key={cat}
                style={{
                  background: "#21262d",
                  color: "#c9d1d9",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {cat}: {count}
              </span>
            ))}
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: stats.monitoring_active ? "#3fb950" : "#f85149",
          fontWeight: 600,
        }}
      >
        {stats.monitoring_active ? "MONITORING ACTIVE" : "MONITORING INACTIVE"}
        {" "}&middot; {stats.total_alerts} total alerts
      </div>
    </section>
  );
}

function Header({ accent }: { accent: string }) {
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
      <h3 style={{ margin: 0, color: accent, fontSize: 14, letterSpacing: 1 }}>
        ENVIRONMENT MONITOR
      </h3>
      <span style={{ color: "#8b949e", fontSize: 12 }}>cloud + onprem + hybrid</span>
    </header>
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
