// ── Scoreboard & Service Grid ─────────────────────────────────────────────────

export function Scoreboard({ snapshot }) {
  if (!snapshot) return <div className="no-data">No data yet</div>;

  const metrics = [
    {
      label: "Attacks Attempted",
      value: snapshot.attacks_attempted,
      sub:   "total turns Red has acted",
      color: "var(--red)",
      icon:  "⚔",
    },
    {
      label: "Attacks Blocked",
      value: snapshot.attacks_blocked,
      sub:   `${snapshot.block_rate}% block rate`,
      color: "var(--blue)",
      icon:  "🛡",
    },
    {
      label: "False Positives",
      value: snapshot.false_positives ?? 0,
      sub:   "Blue fired when Red wasn't attacking",
      color: "var(--orange)",
      icon:  "⚠",
    },
    {
      label: "Flags Captured",
      value: `${snapshot.flags_captured} / 6`,
      sub:   "services fully exfiltrated",
      color: snapshot.flags_captured > 0 ? "var(--flag)" : "var(--dim)",
      icon:  "🚩",
    },
    {
      label: "Services Up",
      value: `${snapshot.services_up} / 6`,
      sub:   "healthy containers",
      color: snapshot.services_up === 6 ? "var(--green)" : "var(--orange)",
      icon:  "🖥",
    },
    {
      label: "MTTD",
      value: snapshot.mttd ? `${snapshot.mttd}s` : "—",
      sub:   "mean time to detect",
      color: "var(--cyan)",
      icon:  "👁",
    },
    {
      label: "MTTR",
      value: snapshot.mttr ? `${snapshot.mttr}s` : "—",
      sub:   "mean time to respond",
      color: "var(--purple)",
      icon:  "⚡",
    },
    {
      label: "Precision",
      value: snapshot.human_requests > 0 
        ? `${(100 - (snapshot.human_fp / snapshot.human_requests * 100)).toFixed(1)}%`
        : "—",
      sub:   "detection accuracy",
      color: "var(--cyan)",
      icon:  "🎯",
    },
    {
      label: "Human Traffic",
      value: snapshot.human_requests ?? 0,
      sub:   "benign requests this session",
      color: "var(--green)",
      icon:  "🧑",
    },
    {
      label: "Human FP",
      value: snapshot.human_fp ?? 0,
      sub:   "Blue fired on real-user IPs",
      color: (snapshot.human_fp ?? 0) > 0 ? "var(--red)" : "var(--dim)",
      icon:  "🚫",
    },
  ];

  return (
    <div className="scoreboard-grid">
      {metrics.map(m => (
        <div key={m.label} className="metric-card">
          <div className="metric-icon">{m.icon}</div>
          <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
          <div className="metric-label">{m.label}</div>
          <div className="metric-sub">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Service Grid ──────────────────────────────────────────────────────────────
const SERVICE_CVE = {
  "flask-sqli":         "CWE-89",
  "node-pathtraversal": "CWE-22",
  "jwt-auth":           "CVE-2015-9235",
  "postgres-weak":      "CWE-521",
  "redis-noauth":       "CVE-2022-0543",
  "nginx-misconfig":    "CWE-284",
};

export function ServiceGrid({ services }) {
  if (!services) return null;

  return (
    <div className="service-grid">
      {Object.entries(services).map(([name, s]) => {
        let state = "up";
        if (s.flag_stolen) state = "pwned";
        else if (!s.up)     state = "down";

        return (
          <div key={name} className={`service-card service-${state}`}>
            <div className="service-header">
              <span className={`service-status-dot dot-${state}`} />
              <span className="service-name">{name.replace(/-/g, "‑")}</span>
            </div>
            <div className="service-cve">{SERVICE_CVE[name] ?? "?"}</div>
            <div className="service-badges">
              {s.flag_stolen && <span className="svc-badge badge-pwned">🚩 pwned</span>}
              {!s.up         && !s.flag_stolen && <span className="svc-badge badge-down">✕ down</span>}
              {s.up && !s.flag_stolen && <span className="svc-badge badge-ok">✓ live</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}