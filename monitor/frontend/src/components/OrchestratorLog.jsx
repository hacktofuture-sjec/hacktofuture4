import { useRef, useEffect } from "react";

const LEVEL_STYLE = {
  INFO: { badge: "orch-badge-info",  text: "orch-msg-info"  },
  WARN: { badge: "orch-badge-warn",  text: "orch-msg-warn"  },
  RED:  { badge: "orch-badge-red",   text: "orch-msg-red"   },
  BLUE: { badge: "orch-badge-blue",  text: "orch-msg-blue"  },
  CRIT: { badge: "orch-badge-crit",  text: "orch-msg-crit"  },
};

export function OrchestratorLog({ logs }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [logs?.length]);

  return (
    <div className="feed-panel">
      <div className="feed-header orch-header">
        <span className="orch-icon">⚙</span>
        <span className="feed-label" style={{ color: "var(--orch)" }}>Orchestrator</span>
        <span className="feed-count">{logs.length} entries</span>
      </div>

      <div ref={ref} className="feed-body">
        {logs.length === 0 && (
          <p className="feed-empty">No orchestrator events yet…</p>
        )}
        {logs.map((entry, i) => {
          const s = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.INFO;
          return (
            <div key={i} className="log-row orch-row">
              <span className="log-ts">{entry.ts?.slice(11, 19)}</span>
              <span className={`orch-badge ${s.badge}`}>{entry.level}</span>
              <span className={`orch-msg ${s.text}`}>{entry.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
