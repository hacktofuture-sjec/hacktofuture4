from contextlib import asynccontextmanager
import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import get_db
from realtime.broadcaster import WebSocketBroadcaster
from routers import agents, cost, fault_injection, health, incidents, memory, scenarios


broadcaster = WebSocketBroadcaster()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate DB connectivity at startup.
    db = get_db()
    db.execute("SELECT 1")

    # Load scenarios from disk if they are not already present.
    scenarios_file = Path(__file__).resolve().parent / "data" / "scenarios.json"
    if scenarios_file.exists():
        with scenarios_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
        for scenario in data.get("scenarios", []):
            existing = db.execute(
                "SELECT 1 FROM scenarios WHERE scenario_id=?", (scenario["scenario_id"],)
            ).fetchone()
            if not existing:
                db.execute(
                    "INSERT INTO scenarios (scenario_id, name, failure_class, scenario_json, loaded_at) "
                    "VALUES (?, ?, ?, ?, datetime('now'))",
                    (
                        scenario["scenario_id"],
                        scenario["name"],
                        scenario["failure_class"],
                        json.dumps(scenario),
                    ),
                )
        db.commit()

    db.close()
    app.state.broadcaster = broadcaster
    yield


app = FastAPI(
    title="T3PS2 - Autonomous Kubernetes Incident Response",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
app.include_router(agents.router, prefix="/incidents", tags=["agents"])
app.include_router(fault_injection.router, tags=["fault-injection"])
app.include_router(scenarios.router, tags=["scenarios"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])
app.include_router(cost.router, tags=["cost"])


@app.get("/")
async def root():
    return {"service": "t3ps2-backend", "status": "running", "db_path": settings.db_path}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
