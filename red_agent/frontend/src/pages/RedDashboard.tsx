import { useState } from "react";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ChatButton } from "@/components/ChatButton";
import { LogStream } from "@/components/LogStream";
import { useRedWebSocket } from "@/hooks/useRedWebSocket";
import { redApi } from "@/api/redApi";

const ACCENT = "#f85149";

export function RedDashboard() {
  const { connected, toolCalls, logs } = useRedWebSocket();
  const [target, setTarget] = useState("192.168.1.100");
  const [busy, setBusy] = useState(false);

  const handleScan = async () => {
    setBusy(true);
    try {
      await redApi.scanNetwork({ target });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#f0f6fc",
        padding: 20,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 16,
          marginBottom: 16,
          borderBottom: `1px solid ${ACCENT}55`,
        }}
      >
        <div>
          <h1 style={{ color: ACCENT, margin: 0, letterSpacing: 2 }}>
            🔴 RED TEAM // ATTACKER
          </h1>
          <p style={{ color: "#8b949e", margin: "4px 0 0", fontSize: 12 }}>
            target: {target} · ws:{" "}
            <span style={{ color: connected ? "#3fb950" : "#f85149" }}>
              {connected ? "connected" : "disconnected"}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{
              background: "#161b22",
              border: `1px solid ${ACCENT}55`,
              color: "#f0f6fc",
              padding: "8px 10px",
              borderRadius: 4,
              fontFamily: "inherit",
            }}
          />
          <button
            disabled={busy}
            onClick={handleScan}
            style={{
              background: ACCENT,
              color: "#0d1117",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "..." : "RUN SCAN"}
          </button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          height: "calc(100vh - 160px)",
        }}
      >
        <ActivityPanel toolCalls={toolCalls} accent={ACCENT} />
        <LogStream logs={logs} accent={ACCENT} />
      </div>

      <ChatButton accent={ACCENT} />
    </div>
  );
}
