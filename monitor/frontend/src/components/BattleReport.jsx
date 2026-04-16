import { Sparkline } from "./Sparkline";

// ── Service outcome icons ─────────────────────────────────────────────────────
const OUTCOME_STYLE = {
  "🚩 Compromised": { color: "var(--red)",    bg: "rgba(248,113,113,0.08)" },
  "✓ Survived":     { color: "var(--green)",  bg: "rgba(74,222,128,0.08)"  },
};

const KILL_CHAIN_STAGES = [
  "Reconnaissance", "Initial Access", "Credential Access",
  "Collection", "Lateral Movement", "Exfiltration",
];

// ─────────────────────────────────────────────────────────────────────────────
export function BattleReport({ report }) {
  if (!report) return null;

  const w   = report.winner;
  const s   = report.summary;
  const t   = report.timing;
  const red = report.red;
  const blue = report.blue;
  const kc  = report.kill_chain_coverage ?? {};

  // Collect reward values for sparkline from red
  const rewardSparkData = (red?.worst_turn?.reward !== undefined)
    ? [] : [];  // sparkline data comes from snapshot, not report — see XAIPanel

  const winnerColors = {
    RED:  { color: "var(--red)",  bg: "rgba(248,113,113,0.1)", label: "🔴 RED WINS"  },
    BLUE: { color: "var(--blue)", bg: "rgba(96,165,250,0.1)",  label: "🔵 BLUE WINS" },
  };
  const wc = winnerColors[w] ?? { color: "var(--dim)", bg: "transparent", label: "⚖ DRAW" };

  return (
    <div className="report-panel">

      {/* Winner Banner */}
      <div className="report-winner-banner" style={{ background: wc.bg, borderColor: wc.color }}>
        <span className="report-winner-label" style={{ color: wc.color }}>{wc.label}</span>
        <span className="report-winner-sub">
          {report.total_turns} turns · {s.attacks_attempted} attacks · {s.flags_captured}/6 flags
        </span>
      </div>

      {/* Summary metrics row */}
      <div className="report-metrics-row">
        {[
          { label: "Block Rate",   value: `${s.block_rate_pct}%`,    color: "var(--blue)"   },
          { label: "Precision",    value: s.human_requests > 0 ? `${(100 - (s.human_fp / s.human_requests * 100)).toFixed(1)}%` : "—", color: "var(--cyan)" },
          { label: "MTTD",         value: t.mttd_s ? `${t.mttd_s}s` : "—", color: "var(--cyan)"   },
          { label: "False Pos",    value: s.false_positives,         color: "var(--orange)"  },
          { label: "Samples",      value: blue.online_samples,        color: "var(--green)"   },
        ].map(m => (
          <div key={m.label} className="report-metric">
            <div className="report-metric-value" style={{ color: m.color }}>{m.value}</div>
            <div className="report-metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Kill Chain */}
      <div className="report-section">
        <div className="report-section-title">Red Kill Chain</div>
        <div className="kill-chain-track" style={{ marginTop: 0 }}>
          {KILL_CHAIN_STAGES.map(stage => {
            const reached = kc[stage];
            return (
              <div key={stage} className={`kc-stage ${reached ? "kc-reached" : "kc-locked"}`}>
                <div className="kc-dot" />
                <div className="kc-label">{stage}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Human Simulator anti-FP results */}
      <div className="report-section">
        <div className="report-section-title">🧑 Human Simulator — False Positive Audit</div>
        <div className="report-learn-row">
          <div>
            <span className="report-learn-value" style={{ color: "var(--green)" }}>
              {report.summary?.human_requests ?? 0}
            </span>
            <span className="report-learn-sub">benign requests</span>
          </div>
          <div>
            <span className="report-learn-value"
              style={{ color: (report.summary?.human_fp ?? 0) > 0 ? "var(--red)" : "var(--green)" }}>
              {report.summary?.human_fp ?? 0}
            </span>
            <span className="report-learn-sub">human FP fired</span>
          </div>
          <div>
            <span className="report-learn-value" style={{ color: "var(--cyan)" }}>
              {report.summary?.human_requests > 0
                ? `${(100 - ((report.summary?.human_fp ?? 0) / report.summary.human_requests * 100)).toFixed(1)}%`
                : "—"}
            </span>
            <span className="report-learn-sub">precision</span>
          </div>
        </div>
      </div>

      {/* Service outcomes */}
      <div className="report-section">
        <div className="report-section-title">Service Outcomes</div>
        <div className="report-services">
          {Object.entries(report.services ?? {}).map(([name, v]) => {
            const style = OUTCOME_STYLE[v.outcome] ?? {};
            return (
              <div key={name} className="report-service-row"
                   style={{ background: style.bg, borderColor: (style.color ?? "var(--border)") + "44" }}>
                <span className="report-service-name">{name.replace(/-/g, "‑")}</span>
                <span className="report-service-outcome" style={{ color: style.color }}>
                  {v.outcome}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blue learning summary */}
      <div className="report-section">
        <div className="report-section-title">Blue Online Learning</div>
        <div className="report-learn-row">
          <div>
            <span className="report-learn-value" style={{ color: "var(--blue)" }}>
              {Math.round(blue.online_weight * 100)}%
            </span>
            <span className="report-learn-sub">final weight</span>
          </div>
          <div>
            <span className="report-learn-value" style={{ color: "var(--green)" }}>
              {blue.online_samples}
            </span>
            <span className="report-learn-sub">samples</span>
          </div>
          <div>
            <span className="report-learn-value" style={{ color: "var(--cyan)" }}>
              {blue.live_threshold}
            </span>
            <span className="report-learn-sub">final threshold</span>
          </div>
        </div>
      </div>

      {/* Download link */}
      <div className="report-download">
        <a
          href="http://localhost:9000/battle/report.md"
          target="_blank"
          rel="noreferrer"
          className="report-dl-btn"
        >
          ↓ Download Report.md
        </a>
        <a
          href="http://localhost:9000/battle/report"
          target="_blank"
          rel="noreferrer"
          className="report-dl-btn report-dl-json"
        >
          {"{ }"} JSON
        </a>
      </div>
    </div>
  );
}
