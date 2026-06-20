import { useRef, useEffect } from "react";

// ── Colour palette per attack type ────────────────────────────────────────────
const ACTION_COLOR = {
  sqli:             "text-red-400",
  path_traversal:   "text-orange-400",
  jwt_none_forge:   "text-yellow-400",
  brute_postgres:   "text-pink-400",
  redis_noauth:     "text-purple-400",
  nginx_alias_trav: "text-sky-400",
  port_scan:        "text-gray-500",
  exfiltrate:       "text-rose-300",
};

// ── Human-readable one-liner per Red action ──────────────────────────────────
const RED_EXPLAIN = {
  sqli:             "Injected malicious SQL to dump the DB",
  path_traversal:   "Traversed directory paths to read sensitive files",
  jwt_none_forge:   "Forged a JWT with alg=none to bypass auth",
  brute_postgres:   "Brute-forced Postgres with common credentials",
  redis_noauth:     "Connected to Redis without auth to read keys",
  nginx_alias_trav: "Exploited nginx alias misconfiguration",
  port_scan:        "Scanned open ports to map the network",
  exfiltrate:       "Exfiltrated captured flags out of the network",
};

// ── Human-readable one-liner per Blue action ─────────────────────────────────
const BLUE_EXPLAIN = {
  block_ip:        "Blocked source IP at the firewall",
  rate_limit:      "Throttled suspicious IP to prevent flooding",
  add_waf_rule:    "Added WAF rule to reject matching patterns",
  patch_service:   "Applied runtime patch to harden the service",
  CLEAN:           "No threat detected — request looks benign",
};

const SEVERITY_STYLE = {
  HIGH:   { dot: "bg-red-500",    text: "text-red-400"    },
  MEDIUM: { dot: "bg-yellow-500", text: "text-yellow-400" },
  LOW:    { dot: "bg-blue-400",   text: "text-blue-300"   },
  none:   { dot: "bg-gray-600",   text: "text-gray-600"   },
};

// ── Shared scroll-to-top on new events ───────────────────────────────────────
function useAutoScroll(events) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [events?.length]);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
export function RedFeed({ events }) {
  const ref = useAutoScroll(events);

  return (
    <div className="feed-panel">
      {/* Header */}
      <div className="feed-header red-header">
        <span className="pulse-dot red-dot" />
        <span className="feed-label" style={{ color: "var(--red)" }}>Red Agent</span>
        <span className="feed-count">{events.length} events</span>
      </div>

      {/* Scrollable log body */}
      <div ref={ref} className="feed-body">
        {events.length === 0 && (
          <p className="feed-empty">Waiting for battle start…</p>
        )}
        {events.map((ev, i) => {
          const color   = ACTION_COLOR[ev.action] ?? "text-red-300";
          const explain = RED_EXPLAIN[ev.action]  ?? "Unknown action";
          const hasFlag = ev.flags_found > 0;
          return (
            <div key={i} className="log-row">
              <div className="log-row-main">
                <span className="log-ts">{ev.ts?.slice(11, 19)}</span>
                <span className="log-turn">T{ev.turn}</span>
                <span className={`log-action ${color}`}>[{ev.action}]</span>
                <span className={`log-reward ${ev.reward > 0 ? "text-emerald-400" : "text-red-600"}`}>
                  {ev.reward > 0 ? "+" : ""}{ev.reward}
                </span>
                {hasFlag && <span className="log-flag">🚩×{ev.flags_found}</span>}
              </div>
              <div className="log-explain red-explain">{explain}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function BlueFeed({ events }) {
  const ref = useAutoScroll(events);

  return (
    <div className="feed-panel">
      {/* Header */}
      <div className="feed-header blue-header">
        <span className="pulse-dot blue-dot" />
        <span className="feed-label" style={{ color: "var(--blue)" }}>Blue Agent</span>
        <span className="feed-count">{events.length} events</span>
      </div>

      {/* Scrollable log body */}
      <div ref={ref} className="feed-body">
        {events.length === 0 && (
          <p className="feed-empty">Waiting for detections…</p>
        )}
        {events.map((ev, i) =>
          (ev.responses || []).map((r, j) => {
            const sev     = r.severity || "none";
            const style   = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.none;
            const explain = BLUE_EXPLAIN[r.action] ?? "Response issued";
            return (
              <div key={`${i}-${j}`} className="log-row">
                <div className="log-row-main">
                  <span className="log-ts">{ev.ts?.slice(11, 19)}</span>
                  <span className="log-turn">T{ev.turn}</span>
                  <span className={`log-sev-dot ${style.dot}`} />
                  <span className={`log-sev ${style.text}`}>[{sev}]</span>
                  <span className="log-action" style={{ color: "var(--blue-light)" }}>{r.action}</span>
                  <span className="log-class">{r.attack_class}</span>
                  {r.confidence && (
                    <span className="log-conf">{(r.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <div className="log-explain blue-explain">{explain}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}