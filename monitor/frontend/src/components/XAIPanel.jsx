import { Sparkline } from "./Sparkline";
const FEATURE_NAMES = [
  "service_id", "method_id", "path_depth", "args_count",
  "args_length", "has_sqli", "has_path_traversal", "has_jwt_none",
  "is_sensitive_path", "request_size", "failed_login_rate", "is_health_check",
];

// Human-readable explanation of each XGBoost feature for the tooltip/sub-label
const FEATURE_EXPLAIN = {
  service_id:          "Which service received the request",
  method_id:           "HTTP verb used (GET/POST/PUT…)",
  path_depth:          "Depth of the URL path — deep paths often signal traversal",
  args_count:          "Number of query parameters in the request",
  args_length:         "Total length of query-string — long args suggest injection",
  has_sqli:            "Detected SQL injection patterns in args or body",
  has_path_traversal:  "Detected ../ sequences indicating directory traversal",
  has_jwt_none:        "JWT header claims alg=none — unsigned token forgery",
  is_sensitive_path:   "Request targets /admin, /config, /etc… paths",
  request_size:        "Total byte size of the HTTP request",
  failed_login_rate:   "Recent failed login ratio — brute-force signal",
  is_health_check:     "Route is a /health ping — usually benign baseline",
};

const ATTACK_BAR_COLOR = {
  has_sqli:            "#ef4444",
  has_path_traversal:  "#f97316",
  has_jwt_none:        "#eab308",
  failed_login_rate:   "#ec4899",
  is_sensitive_path:   "#a855f7",
  path_depth:          "#06b6d4",
  args_length:         "#3b82f6",
  is_health_check:     "#22c55e",
};

export function XAIPanel({ snapshot }) {
  const lastAlert = snapshot?.blue?.last_action;
  const alerts    = snapshot?.blue?.alerts_fired || 0;
  const redState   = snapshot?.red;
  const blueState  = snapshot?.blue;
  const explanation = snapshot?.blue?.last_explanation || null;

  const featureRows = explanation
    ? explanation.map(({ feature_idx, importance }) => ({
        name:    FEATURE_NAMES[feature_idx] ?? `feat_${feature_idx}`,
        explain: FEATURE_EXPLAIN[FEATURE_NAMES[feature_idx]] ?? "",
        pct:     Math.round(importance * 100),
      })).sort((a, b) => b.pct - a.pct)
    : [
        { name: "has_sqli",           explain: FEATURE_EXPLAIN.has_sqli,           pct: 31 },
        { name: "has_path_traversal", explain: FEATURE_EXPLAIN.has_path_traversal, pct: 24 },
        { name: "has_jwt_none",       explain: FEATURE_EXPLAIN.has_jwt_none,       pct: 18 },
        { name: "failed_login_rate",  explain: FEATURE_EXPLAIN.failed_login_rate,  pct: 14 },
        { name: "is_sensitive_path",  explain: FEATURE_EXPLAIN.is_sensitive_path,  pct: 8  },
        { name: "args_length",        explain: FEATURE_EXPLAIN.args_length,        pct: 5  },
      ];

  const cumulativeReward = redState?.cumulative_reward ?? 0;
  const rewardAbs        = Math.abs(cumulativeReward);
  const rewardMax        = 200;
  // Sparkline: extract per-turn absolute rewards from reward_history
  const rewardSparkData  = (redState?.reward_history ?? []).map(r => r.reward);

  return (
    <div className="xai-panel">

      {/* ── Feature Importance ──────────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">XGBoost — Top Features</span>
          {explanation && <span className="live-badge">● live</span>}
          {!explanation && <span className="static-badge">◌ global avg</span>}
        </div>

        <div className="feature-list">
          {featureRows.map(f => {
            const barColor = ATTACK_BAR_COLOR[f.name] ?? "#64748b";
            return (
              <div key={f.name} className="feature-row">
                <div className="feature-meta">
                  <span className="feature-name">{f.name}</span>
                  <span className="feature-pct">{f.pct}%</span>
                </div>
                <div className="feature-explain-text">{f.explain}</div>
                <div className="feature-bar-track">
                  <div
                    className="feature-bar-fill"
                    style={{
                      width:      `${Math.min(f.pct, 100)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Red Reward ─────────────────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">Red Cumulative Reward</span>
        </div>
        <div className="reward-row">
          <div className="reward-value" style={{ color: cumulativeReward >= 0 ? "var(--red)" : "var(--dim)" }}>
            {cumulativeReward >= 0 ? "+" : ""}{cumulativeReward}
          </div>
          <div className="reward-meta">
            <div className="reward-turn">Turn {snapshot?.turn ?? 0}</div>
            <div className="reward-action">{redState?.last_action ?? "—"}</div>
          </div>
        </div>
        {/* Mini gauge */}
        <div className="reward-gauge-track">
          <div
            className="reward-gauge-fill"
            style={{ width: `${Math.min((rewardAbs / rewardMax) * 100, 100)}%` }}
          />
        </div>
        {/* Reward sparkline */}
        {rewardSparkData.length >= 2 && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)"}}>reward/turn</span>
            <Sparkline
              data={rewardSparkData}
              width={200}
              height={28}
              color="var(--red)"
              fillColor="rgba(239,68,68,0.12)"
            />
          </div>
        )}
      </section>

      {/* ── Red Kill Chain ─────────────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">Red Kill Chain</span>
        </div>
        <div className="kill-chain-track">
          {[
            "Reconnaissance", "Initial Access", "Credential Access",
            "Collection", "Lateral Movement", "Exfiltration",
          ].map(stage => {
            const reached = redState?.kill_chain_reached?.includes(stage);
            return (
              <div key={stage} className={`kc-stage ${reached ? "kc-reached" : "kc-locked"}`}>
                <div className="kc-dot" />
                <div className="kc-label">{stage}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Blue Alerts ────────────────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">Blue Alerts</span>
        </div>
        <div className="blue-stats-row">
          <div className="blue-stat">
            <div className="blue-stat-value" style={{ color: "var(--blue)" }}>{alerts}</div>
            <div className="blue-stat-label">fired</div>
          </div>
          <div className="blue-stat">
            <div className="blue-stat-value" style={{ color: "var(--orange)" }}>
              {snapshot?.false_positives ?? 0}
            </div>
            <div className="blue-stat-label">false pos.</div>
          </div>
          <div className="blue-stat">
            <div className="blue-stat-value" style={{ color: "var(--green)" }}>
              {alerts - (snapshot?.false_positives ?? 0)}
            </div>
            <div className="blue-stat-label">true pos.</div>
          </div>
        </div>
        <div className="blue-last-action">
          Last action: <span style={{ color: "var(--blue-light)" }}>{lastAlert ?? "none"}</span>
        </div>
      </section>

      {/* ── Detection Timing ───────────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">Detection Timing</span>
        </div>
        <div className="timing-grid">
          {[
            { label: "MTTD", value: snapshot?.mttd ? `${snapshot.mttd}s` : "—", sub: "detect",  color: "var(--cyan)"   },
            { label: "MTTR", value: snapshot?.mttr ? `${snapshot.mttr}s` : "—", sub: "respond", color: "var(--purple)" },
            { label: "MTTP", value: snapshot?.mttp ? `${snapshot.mttp}s` : "—", sub: "patch",   color: "var(--indigo)" },
          ].map(t => (
            <div key={t.label} className="timing-card">
              <div className="timing-value" style={{ color: t.color }}>{t.value}</div>
              <div className="timing-label">{t.label}</div>
              <div className="timing-sub">{t.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Blue Online Learning ───────────────────────────────────── */}
      <section className="xai-section">
        <div className="xai-section-header">
          <span className="xai-section-title">Blue Learning</span>
          {blueState?.online_samples > 0 && <span className="live-badge">● adapting</span>}
        </div>
        <div className="timing-grid">
          <div className="timing-card">
            <div className="timing-value" style={{ color: "var(--blue)" }}>
              {blueState?.online_weight != null ? `${Math.round(blueState.online_weight * 100)}%` : "0%"}
            </div>
            <div className="timing-label">Weight</div>
            <div className="timing-sub">online model influence</div>
          </div>
          <div className="timing-card">
            <div className="timing-value" style={{ color: "var(--cyan)" }}>
              {blueState?.live_threshold ?? "0.85"}
            </div>
            <div className="timing-label">Threshold</div>
            <div className="timing-sub">detection sensitivity</div>
          </div>
          <div className="timing-card">
            <div className="timing-value" style={{ color: "var(--green)" }}>
              {blueState?.online_samples ?? 0}
            </div>
            <div className="timing-label">Samples</div>
            <div className="timing-sub">training data seen</div>
          </div>
        </div>
        {/* Learning progress bar */}
        <div className="reward-gauge-track" style={{ marginTop: "10px" }}>
          <div
            className="feature-bar-fill"
            style={{
              width: `${Math.min((blueState?.online_weight ?? 0) * 100 / 0.6 * 100, 100)}%`,
              background: "linear-gradient(90deg, #1e3a5f, #60a5fa)",
            }}
          />
        </div>
      </section>

    </div>
  );
}