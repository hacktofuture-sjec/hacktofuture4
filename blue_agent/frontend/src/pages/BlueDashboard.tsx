import { useState } from "react";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ChatButton } from "@/components/ChatButton";
import { FixPlanPanel } from "@/components/FixPlanPanel";
import { LogStream } from "@/components/LogStream";
import { SSHScanPanel } from "@/components/SSHScanPanel";
import { StatusBar } from "@/components/StatusBar";
import { useBlueWebSocket } from "@/hooks/useBlueWebSocket";
import { blueApi } from "@/api/blueApi";
import type { SSHScanResult } from "@/types/blue.types";

const ACCENT = "#58a6ff";

export function BlueDashboard() {
  const { connected, toolCalls, logs, agentStatus } = useBlueWebSocket();

  const [host, setHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanResult, setScanResult] = useState<SSHScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const hasVulnerabilities =
    scanResult?.success === true && scanResult.total_cves > 0;

  const handleScan = async () => {
    if (!host || !password) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await blueApi.sshScan({
        host,
        ssh_port: parseInt(sshPort, 10),
        username,
        password,
      });
      setScanResult(res);
      if (!res.success) setScanError(res.error || "Scan failed");
    } catch (err: any) {
      setScanError(err?.response?.data?.detail || err?.message || "Connection failed");
    } finally {
      setScanning(false);
    }
  };

  const handleApplyFixes = async () => {
    setApplying(true);
    try {
      const res = await blueApi.sshApplyFixes();
      if (res.services) {
        setScanResult((prev) =>
          prev ? { ...prev, services: res.services, fixes_applied: res.fixes_applied ?? 0 } : prev
        );
      }
    } catch (err: any) {
      setScanError(err?.response?.data?.detail || err?.message || "Fix failed");
    } finally {
      setApplying(false);
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
      {/* Header */}
      <header style={{ paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${ACCENT}55` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <h1 style={{ color: ACCENT, margin: 0, letterSpacing: 2, fontSize: 20 }}>
              BLUE TEAM // AUTONOMOUS DEFENDER
            </h1>
            <p style={{ color: "#8b949e", margin: "4px 0 0", fontSize: 11 }}>
              Step 1: Scan server &rarr; Step 2: Review fix plan &rarr; Step 3: Apply fixes
              &nbsp;&middot;&nbsp;ws:{" "}
              <span style={{ color: connected ? "#3fb950" : "#f85149" }}>
                {connected ? "connected" : "disconnected"}
              </span>
            </p>
          </div>
        </div>

        {/* SSH input bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "#161b22",
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${ACCENT}33`,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: ACCENT, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>TARGET</span>
          <input placeholder="Host / IP" value={host} onChange={(e) => setHost(e.target.value)} style={inputStyle} />
          <span style={{ color: "#8b949e", fontSize: 11 }}>:</span>
          <input placeholder="Port" value={sshPort} onChange={(e) => setSshPort(e.target.value)} style={{ ...inputStyle, width: 55, flex: "none" }} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ ...inputStyle, width: 100, flex: "none" }} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <button
            onClick={handleScan}
            disabled={scanning || applying || !host || !password}
            style={{ ...btnBase, background: scanning ? "#21262d" : ACCENT, color: scanning ? "#8b949e" : "#0d1117" }}
          >
            {scanning ? "SCANNING..." : "SCAN"}
          </button>
          {scanError && <span style={{ color: "#f85149", fontSize: 11 }}>{scanError}</span>}
          {scanResult?.success && scanResult.total_cves === 0 && (
            <span style={{ color: "#3fb950", fontSize: 11 }}>All clean — no vulnerabilities</span>
          )}
        </div>
      </header>

      {/* Status bar */}
      <StatusBar status={agentStatus} accent={ACCENT} />

      {/* Main grid — adapts based on scan state */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasVulnerabilities ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr",
          gap: 12,
          marginTop: 12,
          height: "calc(100vh - 230px)",
        }}
      >
        {/* Col 1: Scan results */}
        <SSHScanPanel result={scanResult} accent={ACCENT} />

        {/* Col 2: Fix plan — only when vulnerabilities found */}
        {hasVulnerabilities && (
          <FixPlanPanel
            result={scanResult!}
            applying={applying}
            onApply={handleApplyFixes}
            accent={ACCENT}
          />
        )}

        {/* Activity */}
        <ActivityPanel toolCalls={toolCalls} accent={ACCENT} limit={30} />

        {/* Logs */}
        <LogStream logs={logs} accent={ACCENT} />
      </div>

      <ChatButton accent={ACCENT} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #30363d",
  color: "#f0f6fc",
  padding: "7px 10px",
  borderRadius: 4,
  fontFamily: "inherit",
  fontSize: 12,
  flex: 1,
  minWidth: 0,
};

const btnBase: React.CSSProperties = {
  border: "none",
  padding: "8px 18px",
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: 1,
  whiteSpace: "nowrap",
};
