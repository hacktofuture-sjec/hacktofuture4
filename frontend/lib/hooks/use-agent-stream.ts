"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { AgentLog } from "@/lib/types";

interface StreamState {
  logs: AgentLog[];
  done: boolean;
  error: string | null;
}

export function useAgentStream(incidentId: string | null) {
  const [state, setState] = useState<StreamState>({
    logs: [],
    done: false,
    error: null,
  });

  const reset = useCallback(() => {
    setState({ logs: [], done: false, error: null });
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
            data: AgentLog | { status: string };
          };
          if (event.type === "agent_log") {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, event.data as AgentLog],
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
