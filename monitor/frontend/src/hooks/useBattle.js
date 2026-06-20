import { useEffect, useState, useCallback, useRef } from "react";

const ORC = "http://localhost:9000";
const WS  = "ws://localhost:9000/ws";

export function useBattle() {
  const [connected,        setConnected]        = useState(false);
  const [snapshot,         setSnapshot]         = useState(null);
  const [redFeed,          setRedFeed]           = useState([]);   // last 200 red events
  const [blueFeed,         setBlueFeed]          = useState([]);   // last 200 blue events
  const [timeline,         setTimeline]          = useState([]);   // last 100 events
  const [orchestratorLogs, setOrchestratorLogs] = useState([]);   // last 200 orch logs
  const [battleStatus,     setBattleStatus]      = useState("idle"); // idle|running|ended
  const [winner,           setWinner]            = useState(null);
  const [battleReport,     setBattleReport]      = useState(null);  // end-of-battle report
  const ws = useRef(null);

  useEffect(() => {
    const connect = () => {
      const sock = new WebSocket(WS);
      ws.current = sock;

      sock.onopen  = () => setConnected(true);
      sock.onclose = () => { setConnected(false); setTimeout(connect, 3000); };

      sock.onmessage = (e) => {
        const { type, payload } = JSON.parse(e.data);
        switch (type) {
          case "state_update":
            setSnapshot(payload);
            if (payload.timeline_tail) setTimeline(t => {
              const merged = [...t, ...payload.timeline_tail];
              const seen = new Set();
              return merged.filter(ev => {
                const key = `${ev.ts}-${ev.turn}`;
                if (seen.has(key)) return false;
                seen.add(key); return true;
              }).slice(-100);
            });
            break;
          case "red_action":
            setRedFeed(f => [payload, ...f].slice(0, 200));
            break;
          case "blue_action":
            setBlueFeed(f => [payload, ...f].slice(0, 200));
            break;
          case "orchestrator_log":
            setOrchestratorLogs(f => [payload, ...f].slice(0, 200));
            break;
          case "battle_start":
            setBattleStatus("running"); setWinner(null);
            break;
          case "battle_end":
            setBattleStatus("ended"); setWinner(payload.winner);
            break;
          case "battle_report":
            setBattleReport(payload);
            break;
          case "battle_reset":
            setBattleStatus("idle"); setWinner(null);
            setBattleReport(null);
            setRedFeed([]); setBlueFeed([]); setTimeline([]);
            setOrchestratorLogs([]);
            break;
        }
      };
    };
    connect();
    return () => ws.current?.close();
  }, []);

  const startBattle = useCallback(() =>
    fetch(`${ORC}/battle/start`, { method: "POST" }), []);
  const stopBattle  = useCallback(() =>
    fetch(`${ORC}/battle/stop`,  { method: "POST" }), []);
  const resetBattle = useCallback(() =>
    fetch(`${ORC}/battle/reset`, { method: "POST" }), []);

  return {
    connected, snapshot, redFeed, blueFeed, timeline,
    orchestratorLogs, battleStatus, winner, battleReport,
    startBattle, stopBattle, resetBattle,
  };
}