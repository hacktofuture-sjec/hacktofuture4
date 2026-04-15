import type { CSSProperties } from "react";
import type { ToolCall, ToolStatus } from "@/types/red.types";

interface ToolCardProps {
  tool: ToolCall;
  accent?: string;
}

const STATUS_COLORS: Record<ToolStatus, string> = {
  DONE: "#3fb950",
  RUNNING: "#d29922",
  PENDING: "#8b949e",
  FAILED: "#f85149",
};

export function ToolCard({ tool, accent = "#f85149" }: ToolCardProps) {
  const badgeStyle: CSSProperties = {
    background: STATUS_COLORS[tool.status] ?? "#8b949e",
    color: "#0d1117",
    fontWeight: 700,
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: 0.5,
  };

  return (
    <div
      style={{
        background: "#161b22",
        border: `1px solid ${accent}33`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 8,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#f0f6fc",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>{tool.name}</span>
        <span style={badgeStyle}>{tool.status}</span>
      </div>
      <pre
        style={{
          margin: "8px 0 0",
          fontSize: 11,
          color: "#8b949e",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(tool.params, null, 2)}
      </pre>
      {tool.result && (
        <pre
          style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: "#7ee787",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          → {JSON.stringify(tool.result)}
        </pre>
      )}
    </div>
  );
}
