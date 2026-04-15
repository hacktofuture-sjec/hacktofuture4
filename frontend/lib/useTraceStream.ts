import { useEffect, useMemo, useState } from "react";

export type TraceSource = {
  title: string;
  path: string;
};

export type TraceStep = {
  step: string;
  agent: string;
  observation: string;
  sources: TraceSource[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function useTraceStream(traceId: string | null) {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const streamUrl = useMemo(() => {
    if (!traceId) {
      return null;
    }
    return `${API_BASE_URL}/api/chat/stream?trace_id=${encodeURIComponent(traceId)}`;
  }, [traceId]);

  useEffect(() => {
    if (!streamUrl) {
      setSteps([]);
      setIsStreaming(false);
      setStreamError(null);
      return;
    }

    setSteps([]);
    setIsStreaming(true);
    setStreamError(null);

    const eventSource = new EventSource(streamUrl);

    const onTraceStep = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as TraceStep;
        setSteps((previous) => [...previous, parsed]);
      } catch {
        setStreamError("Failed to parse trace event payload.");
      }
    };

    eventSource.addEventListener("trace_step", onTraceStep);

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.removeEventListener("trace_step", onTraceStep);
      eventSource.close();
      setIsStreaming(false);
    };
  }, [streamUrl]);

  return {
    steps,
    isStreaming,
    streamError,
  };
}
