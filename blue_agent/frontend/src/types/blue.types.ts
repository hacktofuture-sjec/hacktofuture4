export type ToolStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ToolCall {
  id: string;
  name: string;
  category: "defend" | "patch" | "strategy" | string;
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
  | { type: "heartbeat"; payload: Record<string, never> };

export interface ClosePortRequest {
  host: string;
  port: number;
  protocol?: string;
}

export interface HardenServiceRequest {
  host: string;
  service: string;
  options?: Record<string, unknown>;
}
