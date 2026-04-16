"""
Orchestrator — FastAPI app
WebSocket hub that streams all battle events to connected dashboards.
"""
import asyncio, json, logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from orchestrator.battle import BattleOrchestrator

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")

app = FastAPI(title="RedBlue Orchestrator")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── WebSocket connection hub ──────────────────────────────────────────────────
class Hub:
    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)
        log.info(f"Dashboard connected ({len(self._clients)} total)")

    def disconnect(self, ws: WebSocket):
        self._clients.remove(ws)

    async def broadcast(self, event_type: str, payload: dict):
        msg = json.dumps({"type": event_type, "payload": payload})
        dead = []
        for ws in self._clients:
            try:
                await ws.send_text(msg)
            except:
                dead.append(ws)
        for ws in dead:
            self._clients.remove(ws)

hub        = Hub()
orchestrator: BattleOrchestrator | None = None

def get_orchestrator() -> BattleOrchestrator:
    global orchestrator
    if orchestrator is None:
        orchestrator = BattleOrchestrator(broadcast_fn=hub.broadcast)
    return orchestrator

# ── REST endpoints ─────────────────────────────────────────────────────────────
@app.post("/battle/start")
async def start_battle():
    orch = get_orchestrator()
    if orch.state["running"]:
        return {"status": "already_running"}
    await orch.start()
    return {"status": "started"}

@app.post("/battle/stop")
async def stop_battle():
    orch = get_orchestrator()
    await orch.stop()
    return {"status": "stopped"}

@app.post("/battle/reset")
async def reset_battle():
    orch = get_orchestrator()
    await orch.reset()
    return {"status": "reset"}

@app.get("/battle/state")
async def battle_state():
    orch = get_orchestrator()
    return orch._snapshot()

@app.get("/battle/report")
async def battle_report():
    """Return the latest end-of-battle report as JSON. 404 if battle not yet ended."""
    from fastapi import HTTPException
    orch = get_orchestrator()
    if orch._last_report is None:
        raise HTTPException(status_code=404, detail="No battle report available yet")
    return orch._last_report

@app.get("/battle/report.md", response_class=__import__("fastapi").responses.PlainTextResponse)
async def battle_report_md():
    """Return the latest end-of-battle report as Markdown text."""
    from fastapi import HTTPException
    from fastapi.responses import PlainTextResponse
    from orchestrator.report import report_to_markdown
    orch = get_orchestrator()
    if orch._last_report is None:
        raise HTTPException(status_code=404, detail="No battle report available yet")
    return PlainTextResponse(report_to_markdown(orch._last_report), media_type="text/markdown")

# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    orch = get_orchestrator()
    # Send current state immediately on connect
    await ws.send_text(json.dumps({
        "type": "state_update",
        "payload": orch._snapshot()
    }))
    try:
        while True:
            # Keep alive — client can send "ping"
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        hub.disconnect(ws)
        log.info("Dashboard disconnected")