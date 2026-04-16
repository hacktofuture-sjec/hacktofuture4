import type { EvolutionMetrics } from "@/types/blue.types";

interface EvolutionPanelProps {
  metrics: EvolutionMetrics | null;
  accent?: string;
}

export function EvolutionPanel({ metrics, accent = "#58a6ff" }: EvolutionPanelProps) {
  if (!metrics) {
    return (
      <section style={sectionStyle(accent)}>
        <Header accent={accent} />
        <p style={{ color: "#8b949e", fontSize: 12 }}>Evolver initializing...</p>
      </section>
    );
  }

  const improvementColor =
    metrics.improvement_pct > 10 ? "#3fb950" : metrics.improvement_pct > 0 ? "#d29922" : "#8b949e";

  return (
    <section style={sectionStyle(accent)}>
      <Header accent={accent} />

      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <MetricBox label="Evolutions" value={metrics.evolution_count} color="#a371f7" />
        <MetricBox label="Rounds" value={metrics.round_count} color={accent} />
        <MetricBox
          label="Avg Response"
          value={`${metrics.avg_response_time_ms.toFixed(0)}ms`}
          color="#d29922"
        />
        <MetricBox
          label="Accuracy"
          value={`${metrics.response_accuracy_pct.toFixed(1)}%`}
          color="#3fb950"
        />
        <MetricBox
          label="Improvement"
          value={`${metrics.improvement_pct.toFixed(1)}%`}
          color={improvementColor}
        />
      </div>

      {metrics.current_params && Object.keys(metrics.current_params).length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>TUNED PARAMETERS</div>
          <div
            style={{
              background: "#010409",
              padding: 8,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              color: "#7ee787",
              marginBottom: 10,
              maxHeight: 80,
              overflowY: "auto",
            }}
          >
            {Object.entries(metrics.current_params).map(([key, val]) => (
              <div key={key}>
                <span style={{ color: "#8b949e" }}>{key}:</span>{" "}
                {typeof val === "number" ? val.toFixed(2) : String(val)}
              </div>
            ))}
          </div>
        </>
      )}

      {metrics.top_attack_patterns.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 6 }}>
            TOP ATTACK PATTERNS ({metrics.total_patterns_tracked} tracked)
          </div>
          <div style={{ fontSize: 11 }}>
            {metrics.top_attack_patterns.slice(0, 5).map((p) => (
              <div key={p.pattern} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#c9d1d9" }}>{p.pattern}</span>
                <span style={{ color: "#f0883e", fontWeight: 600 }}>{p.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
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
        DEFENSIVE EVOLUTION
      </h3>
      <span style={{ color: "#8b949e", fontSize: 12 }}>learning</span>
    </header>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase" }}>{label}</div>
    </div>
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
