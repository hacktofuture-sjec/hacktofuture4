import { useState } from "react";
import type { ToolCall, ToolStatus } from "@/types/red.types";

interface ToolCardProps { tool: ToolCall; }

const STATUS: Record<ToolStatus, { color: string; bg: string; icon: string }> = {
  DONE:    { color: "var(--green)",  bg: "var(--green-dim)",  icon: "\u2713" },
  RUNNING: { color: "var(--yellow)", bg: "var(--yellow-dim)", icon: "\u25B6" },
  PENDING: { color: "var(--text-dim)", bg: "transparent",     icon: "\u25CB" },
  FAILED:  { color: "var(--red)",    bg: "var(--red-dim)",    icon: "\u2717" },
};

function elapsed(started: string, finished: string | null): string {
  const sec = Math.floor(((finished ? new Date(finished).getTime() : Date.now()) - new Date(started).getTime()) / 1000);
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${sec % 60}s`;
}

export function ToolCard({ tool }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const s = STATUS[tool.status] ?? STATUS.PENDING;
  const isRunning = tool.status === "RUNNING";

  return (
    <div
      className={isRunning ? "anim-border-glow" : "anim-slide-up"}
      onClick={() => setOpen(!open)}
      style={{
        background: "var(--bg-secondary)", borderRadius: "var(--radius)",
        padding: "8px 10px", border: "1px solid var(--accent-border)",
        borderLeft: `3px solid ${s.color}`, cursor: "pointer",
        transition: "all var(--transition)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className={isRunning ? "anim-pulse" : ""} style={{ color: s.color, fontSize: 11 }}>{s.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-ui)", letterSpacing: 0.5 }}>
            {tool.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{elapsed(tool.started_at, tool.finished_at)}</span>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
            background: s.bg, color: s.color, letterSpacing: 0.5,
            fontFamily: "var(--font-display)",
          }}>
            {tool.status}
          </span>
        </div>
      </div>

      {isRunning && (
        <div style={{ marginTop: 6, height: 2, borderRadius: 1, overflow: "hidden" }}>
          <div className="shimmer-bar" style={{ height: "100%", borderRadius: 1 }} />
        </div>
      )}

      {open && tool.result && (
        <pre style={{
          fontSize: 9, color: "var(--green)", marginTop: 6, padding: "6px 8px",
          background: "var(--bg-void)", borderRadius: 4, whiteSpace: "pre-wrap",
          wordBreak: "break-word", maxHeight: 150, overflowY: "auto",
          border: "1px solid var(--green-dim)",
        }}>
          {JSON.stringify(tool.result, null, 2)}
        </pre>
      )}

      {!open && tool.result && (
        <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
          {s.icon} click to expand result
        </div>
      )}
    </div>
  );
}
