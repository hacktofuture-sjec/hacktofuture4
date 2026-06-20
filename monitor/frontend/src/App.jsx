import { useBattle } from "./hooks/useBattle";
import { RedFeed, BlueFeed } from "./components/AgentFeed";
import { Scoreboard, ServiceGrid } from "./components/Scoreboard";
import { XAIPanel } from "./components/XAIPanel";
import { OrchestratorLog } from "./components/OrchestratorLog";
import { BattleReport } from "./components/BattleReport";

// ── Top status bar ─────────────────────────────────────────────────────────────
function StatusBar({ connected, battleStatus, winner, onStart, onStop, onReset }) {
  return (
    <header className="status-bar">
      <div className="status-bar-left">
        <h1 className="war-room-title">
          <span className="title-red">RED</span>
          <span className="title-vs">vs</span>
          <span className="title-blue">BLUE</span>
          <span className="title-sub">· War Room</span>
        </h1>
        <div className="status-bar-meta">
          <div className={`conn-pill ${connected ? "conn-ok" : "conn-err"}`}>
            <span className={`conn-dot ${connected ? "conn-dot-ok" : "conn-dot-err"}`} />
            {connected ? "Orchestrator connected" : "Disconnected — retrying"}
          </div>
          {winner && (
            <div className={`winner-pill ${winner === "RED" ? "winner-red" : "winner-blue"}`}>
              {winner} WINS
            </div>
          )}
          <div className={`status-pill status-${battleStatus}`}>
            {battleStatus.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="status-bar-controls">
        <button
          className="ctrl-btn ctrl-start"
          onClick={onStart}
          disabled={battleStatus === "running"}
        >
          ▶ START
        </button>
        <button
          className="ctrl-btn ctrl-stop"
          onClick={onStop}
          disabled={battleStatus !== "running"}
        >
          ■ STOP
        </button>
        <button className="ctrl-btn ctrl-reset" onClick={onReset}>
          ↺ RESET
        </button>
      </div>
    </header>
  );
}

// ── Panel wrapper with label ────────────────────────────────────────────────────
function Panel({ title, accent, children, className = "" }) {
  return (
    <div className={`panel ${className}`} style={accent ? { "--panel-accent": accent } : {}}>
      {title && (
        <div className="panel-label">{title}</div>
      )}
      {children}
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────────────────────
export default function App() {
  const battle = useBattle();

  return (
    <div className="app-root">
      <StatusBar
        connected={battle.connected}
        battleStatus={battle.battleStatus}
        winner={battle.winner}
        onStart={battle.startBattle}
        onStop={battle.stopBattle}
        onReset={battle.resetBattle}
      />

      <main className="app-main">

        {/* End of Battle Report Overlay */}
        {battle.battleReport && (
          <div className="report-overlay">
            <BattleReport report={battle.battleReport} />
          </div>
        )}

        {/* ── Row 1: Three-column agent / stats / XAI ── */}
        <div className="main-grid">

          {/* Col A: Agent feeds */}
          <div className="col-feeds">
            <Panel accent="var(--red)">
              <RedFeed events={battle.redFeed} />
            </Panel>
            <Panel accent="var(--blue)">
              <BlueFeed events={battle.blueFeed} />
            </Panel>
          </div>

          {/* Col B: Scoreboard + services */}
          <div className="col-stats">
            <Panel title="Scoreboard">
              <Scoreboard snapshot={battle.snapshot} />
            </Panel>
            <Panel title="Service Status">
              <ServiceGrid services={battle.snapshot?.services} />
            </Panel>
          </div>

          {/* Col C: XAI */}
          <div className="col-xai">
            <Panel title="ML Explainability">
              <XAIPanel snapshot={battle.snapshot} />
            </Panel>
          </div>

        </div>

        {/* ── Row 2: Orchestrator log — full width ── */}
        <div className="orch-row">
          <Panel accent="var(--orch)">
            <OrchestratorLog logs={battle.orchestratorLogs} />
          </Panel>
        </div>

      </main>
    </div>
  );
}