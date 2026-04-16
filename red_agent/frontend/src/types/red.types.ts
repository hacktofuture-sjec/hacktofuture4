export type ToolStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ToolCall {
  id: string;
  name: string;
  category: "scan" | "exploit" | "strategy" | string;
  status: ToolStatus;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
}

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | string;
  message: string;
  tool_id: string | null;
}

export type WsEnvelope =
  | { type: "tool_call"; payload: ToolCall }
  | { type: "log"; payload: LogEntry }
  | { type: "chat_response"; payload: ChatMessage }
  | { type: "mission_phase"; payload: MissionPhaseUpdate }
  | { type: "heartbeat"; payload: Record<string, never> };

export interface ScanRequest {
  target: string;
  ports?: number[];
  options?: Record<string, unknown>;
}

/* ── Chat ── */
export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  tool_calls?: ToolCallRef[];
}

export interface ToolCallRef {
  tool_id: string;
  tool_name: string;
  status: ToolStatus;
}

export interface ChatRequest {
  message: string;
  target?: string;
}

/* ── Mission ── */
export type MissionPhaseValue =
  | "IDLE"
  | "RECON"
  | "ANALYZE"
  | "PLAN"
  | "EXPLOIT"
  | "REPORT"
  | "DONE"
  | "FAILED"
  | "PAUSED";

export interface MissionPhaseUpdate {
  mission_id: string;
  phase: MissionPhaseValue;
}
