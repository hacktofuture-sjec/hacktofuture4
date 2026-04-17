from fastapi import WebSocket


class WebSocketBroadcaster:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.recent_buffer: list[dict] = []
        self.max_buffer = 10

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        for msg in self.recent_buffer[-self.max_buffer :]:
            try:
                await websocket.send_json(msg)
            except Exception:
                continue

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        self.recent_buffer.append(message)
        if len(self.recent_buffer) > self.max_buffer:
            self.recent_buffer = self.recent_buffer[-self.max_buffer :]

        stale: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)

        for connection in stale:
            self.disconnect(connection)
