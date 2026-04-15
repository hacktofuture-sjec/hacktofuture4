import { useState } from "react";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ChatButton } from "@/components/ChatButton";
import { LogStream } from "@/components/LogStream";
import { useBlueWebSocket } from "@/hooks/useBlueWebSocket";
import { blueApi } from "@/api/blueApi";

const ACCENT = "#58a6ff";

export function BlueDashboard() {
  const { connected, toolCalls, logs } = useBlueWebSocket();
  const [host, setHost] = useState("192.168.1.100");
  const [busy, setBusy] = useState(false);

  const handleHarden = async () => {
    setBusy(true);
    try {
      await blueApi.hardenService({ host, service: "ssh" });
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
            🔵 BLUE TEAM // DEFENDER
          </h1>
          <p style={{ color: "#8b949e", margin: "4px 0 0", fontSize: 12 }}>
            host: {host} · ws:{" "}
            <span style={{ color: connected ? "#3fb950" : "#f85149" }}>
              {connected ? "connected" : "disconnected"}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
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
            onClick={handleHarden}
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
            {busy ? "..." : "HARDEN SSH"}
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
