"""Live log + tool-call WebSocket stream for the Red dashboard."""

from __future__ import annotations

import asyncio
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from red_agent.backend.services import red_service

router = APIRouter()


class RedConnectionManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        async with self._lock:
            stale: list[WebSocket] = []
            for ws in self._connections:
                try:
                    await ws.send_json(payload)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self._connections.discard(ws)


manager = RedConnectionManager()


@router.websocket("/ws/red")
async def red_log_stream(ws: WebSocket) -> None:
    """Streams `{type, payload}` envelopes to the Red dashboard.

    Envelope types:
      - `log`        : a LogEntry
      - `tool_call`  : a ToolCall snapshot
      - `heartbeat`  : keepalive ping
    """
    await manager.connect(ws)
    try:
        # Replay recent state on connect so the UI can hydrate immediately.
        for call in await red_service.recent_tool_calls(limit=20):
            await ws.send_json({"type": "tool_call", "payload": call.model_dump(mode="json")})
        for entry in await red_service.recent_logs(limit=50):
            await ws.send_json({"type": "log", "payload": entry.model_dump(mode="json")})

        while True:
            await asyncio.sleep(15)
            await ws.send_json({"type": "heartbeat", "payload": {}})
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        await manager.disconnect(ws)
        raise
