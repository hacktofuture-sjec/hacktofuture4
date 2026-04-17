"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { AgentLog, SandboxResult } from "@/lib/types";

interface StreamState {
  logs: AgentLog[];
  sandboxResult: SandboxResult | null;
  status: string | null;
  done: boolean;
  error: string | null;
}

export function useAgentStream(incidentId: string | null) {
  const [state, setState] = useState<StreamState>({
    logs: [],
    sandboxResult: null,
    status: null,
    done: false,
    error: null,
  });

  const reset = useCallback(() => {
    setState({ logs: [], sandboxResult: null, status: null, done: false, error: null });
  }, []);

  useEffect(() => {
    if (!incidentId) return;

    let es: EventSource;

    try {
      es = new EventSource(api.streamUrl(incidentId));

      es.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as {
            type: string;
            data: AgentLog | { status: string } | SandboxResult;
          };
          if (event.type === "agent_log") {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, event.data as AgentLog],
            }));
          } else if (event.type === "sandbox_result") {
            setState((prev) => ({
              ...prev,
              sandboxResult: event.data as SandboxResult,
            }));
          } else if (event.type === "status") {
            setState((prev) => ({
              ...prev,
              status: (event.data as { status: string }).status,
            }));
          }
        } catch {
          // ignore parse errors
        }
      };

      es.addEventListener("done", () => {
        setState((prev) => ({ ...prev, done: true }));
        es.close();
      });

      es.onerror = () => {
        setState((prev) => ({ ...prev, error: "Stream connection lost", done: true }));
        es.close();
      };
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err), done: true }));
    }

    return () => {
      es?.close();
    };
  }, [incidentId]);

  return { ...state, reset };
}
