import json
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from db import get_db_dep
from fault_injection.fault_injector import FaultInjector
from models.enums import IncidentStatus
from models.schemas import FaultInjectionRequest, FaultInjectionResponse

router = APIRouter()


def _get_scenario(db: sqlite3.Connection, scenario_id: str) -> dict:
    row = db.execute(
        "SELECT scenario_json FROM scenarios WHERE scenario_id=?", (scenario_id,)
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found. Did you run POST /admin/load-scenarios?",
        )
    return json.loads(row["scenario_json"])


@router.post("/inject-fault", response_model=FaultInjectionResponse)
async def inject_fault(
    body: FaultInjectionRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    scenario = _get_scenario(db, body.scenario_id)
    injector = FaultInjector([scenario])

    duplicate = db.execute(
        """SELECT id FROM incidents
           WHERE service=? AND failure_class=?
           AND status NOT IN ('resolved','failed')
           AND created_at > datetime('now', '-5 minutes')""",
        (scenario["service"], scenario["failure_class"]),
    ).fetchone()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "duplicate_incident",
                "existing_incident_id": duplicate["id"],
                "message": "An active incident for this scenario already exists",
            },
        )

    snapshot = injector.build_snapshot(body.scenario_id)
    incident_id = snapshot.incident_id
    now = datetime.utcnow().isoformat() + "Z"

    db.execute(
        """INSERT INTO incidents
           (id, status, scenario_id, service, namespace, pod, failure_class,
            severity, monitor_confidence, snapshot_json, created_at, updated_at)
           VALUES (?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))""",
        (
            incident_id,
            body.scenario_id,
            snapshot.service,
            snapshot.scope.namespace,
            snapshot.pod,
            snapshot.failure_class.value,
            scenario["severity"],
            snapshot.monitor_confidence,
            json.dumps(snapshot.model_dump()),
        ),
    )
    db.execute(
        "INSERT INTO incident_timeline (incident_id, status, actor, note, timestamp) "
        "VALUES (?, 'open', 'monitor', ?, datetime('now'))",
        (incident_id, f"Fault injected: {body.scenario_id}"),
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "incident_event",
                "incident_id": incident_id,
                "status": "open",
                "scenario_id": body.scenario_id,
                "severity": scenario["severity"],
                "created_at": now,
            }
        )

    return FaultInjectionResponse(
        incident_id=incident_id,
        scenario_id=body.scenario_id,
        status=IncidentStatus.OPEN,
        message="Incident opened and detection cycle complete",
    )
