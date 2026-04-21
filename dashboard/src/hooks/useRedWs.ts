import { useState, useEffect, useRef, useCallback } from "react";
import type { ToolCall, LogEntry, ChatMessage, MissionPhase, AutoPwnStep } from "@/types";

const WS_URL = "ws://localhost:8001/ws/red";

export interface CveAlert {
  id: string;
  description: string;
  cvss_score: number;
  severity: string;
  published: string;
  affected_products: string[];
}

const STORAGE_KEYS = {
  toolCalls: "arena_red_tools",
  logs: "arena_red_logs",
  chatMessages: "arena_red_chat",
  missionPhase: "arena_red_phase",
  autoPwnSteps: "arena_red_autopwn",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

export function useRedWs() {
  const [connected, setConnected] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>(() => load(STORAGE_KEYS.toolCalls, []));
  const [logs, setLogs] = useState<LogEntry[]>(() => load(STORAGE_KEYS.logs, []));
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => load(STORAGE_KEYS.chatMessages, []));
  const [missionPhase, setMissionPhase] = useState<MissionPhase | null>(() => load(STORAGE_KEYS.missionPhase, null));
  const [autoPwnSteps, setAutoPwnSteps] = useState<AutoPwnStep[]>(() => load(STORAGE_KEYS.autoPwnSteps, []));
  const [cveAlerts, setCveAlerts] = useState<CveAlert[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => { save(STORAGE_KEYS.toolCalls, toolCalls); }, [toolCalls]);
  useEffect(() => { save(STORAGE_KEYS.logs, logs); }, [logs]);
  useEffect(() => { save(STORAGE_KEYS.chatMessages, chatMessages); }, [chatMessages]);
  useEffect(() => { save(STORAGE_KEYS.missionPhase, missionPhase); }, [missionPhase]);
  useEffect(() => { save(STORAGE_KEYS.autoPwnSteps, autoPwnSteps); }, [autoPwnSteps]);

  const connect = useCallback(() => {
    const s = new WebSocket(WS_URL);
    ws.current = s;

    s.onopen = () => setConnected(true);
    s.onclose = () => { setConnected(false); setTimeout(connect, 2000); };
    s.onerror = () => s.close();

    s.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "session_start":
            setToolCalls([]); setLogs([]); setChatMessages([]);
            setMissionPhase(null); setAutoPwnSteps([]);
            Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
            break;
          case "tool_call":
            // Dedup by id — collapse RUNNING → DONE/FAILED into one card
            setToolCalls(p => {
              const filtered = p.filter(t => t.id !== msg.payload.id);
              return [...filtered, msg.payload].slice(-100);
            });
            break;
          case "log":
            setLogs(p => [...p.slice(-499), msg.payload]);
            break;
          case "chat_response":
          case "chat":
            setChatMessages(p => [...p.slice(-99), msg.payload]);
            break;
          case "mission_phase":
            setMissionPhase(msg.payload);
            break;
          case "auto_pwn_step":
            setAutoPwnSteps(p => {
              const filtered = p.filter(s => s.id !== msg.payload.id);
              return [...filtered, msg.payload].slice(-100);
            });
            break;
          case "cve_alert":
            setCveAlerts(p => [msg.payload as CveAlert, ...p].slice(0, 50));
            break;
        }
      } catch { /* ignore malformed */ }
    };
  }, []);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  const sendMissionControl = useCallback((action: string, missionId: string) => {
    ws.current?.send(JSON.stringify({ type: "mission_control", payload: { action, mission_id: missionId } }));
  }, []);

  const clearToolCalls = useCallback(() => {
    setToolCalls([]); localStorage.removeItem(STORAGE_KEYS.toolCalls);
  }, []);
  const clearLogs = useCallback(() => {
    setLogs([]); localStorage.removeItem(STORAGE_KEYS.logs);
  }, []);
  const clearAutoPwn = useCallback(() => {
    setAutoPwnSteps([]); localStorage.removeItem(STORAGE_KEYS.autoPwnSteps);
  }, []);

  return { connected, toolCalls, logs, chatMessages, missionPhase, autoPwnSteps, cveAlerts, sendMissionControl, clearToolCalls, clearLogs, clearAutoPwn };
}
