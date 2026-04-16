import { useEffect, useRef, useCallback, useState } from "react";
import { WSMessage } from "@/lib/types";

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const messageHandlerRef = useRef(onMessage);

  useEffect(() => {
    messageHandlerRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    const url = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000") + "/ws";
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.current.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data);
        messageHandlerRef.current(msg);
      } catch (error) {
        console.error("Failed to process WebSocket message", error, e.data);
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
      if (shouldReconnect.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { connected };
}
