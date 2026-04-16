from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from db import get_db_dep
from executor.action_runner import ActionRunner
from executor.vcluster_manager import VClusterManager
from diagnosis.diagnose_agent import DiagnoseAgent
from governance.token_governor import TokenGovernor
from incident.state_machine import assert_transition
from models.enums import IncidentStatus
from models.schemas import ApprovalRequest, DiagnosisPayload, IncidentSnapshot, PlannerOutput
from planner.plan_simulator import simulate_action
from planner.planner_agent import PlannerAgent
from agents.executor_agent import ExecutorAgent
from memory.incident_memory_store import IncidentMemoryStore
from verifier.recovery_checker import RecoveryChecker
from config import settings

router = APIRouter()


def _get_incident_row(db: sqlite3.Connection, incident_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail={"error": "not_found", "incident_id": incident_id})
    return row


def _snapshot(db: sqlite3.Connection, incident_id: str) -> IncidentSnapshot:
    row = _get_incident_row(db, incident_id)
    if not row["snapshot_json"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "snapshot_missing", "message": "No snapshot found for this incident"},
        )
    return IncidentSnapshot(**json.loads(row["snapshot_json"]))


def _timeline(db: sqlite3.Connection, incident_id: str, status: str, actor: str, note: str) -> None:
    db.execute(
        "INSERT INTO incident_timeline (incident_id, status, actor, note, timestamp) "
        "VALUES (?, ?, ?, ?, datetime('now'))",
        (incident_id, status, actor, note),
    )


@router.post("/{incident_id}/diagnose", response_model=DiagnosisPayload)
async def diagnose_incident(
    incident_id: str,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    row = _get_incident_row(db, incident_id)
    current = IncidentStatus(row["status"])
    assert_transition(current, IncidentStatus.DIAGNOSING)

    snapshot = _snapshot(db, incident_id)

    db.execute(
        "UPDATE incidents SET status=?, diagnosed_at=datetime('now'), updated_at=datetime('now') WHERE id=?",
        (IncidentStatus.DIAGNOSING.value, incident_id),
    )
    _timeline(db, incident_id, IncidentStatus.DIAGNOSING.value, "diagnose", "Diagnosis started")
    db.commit()

    governor = TokenGovernor(
        model_name=settings.llm_model_primary,
        budget_cap_per_incident=settings.budget_cap_per_incident_usd,
        budget_cap_per_run=settings.budget_cap_per_run_usd,
    )
    agent = DiagnoseAgent(token_governor=governor, db=db)
    result = agent.run(snapshot)

    db.execute(
        "UPDATE incidents SET diagnosis_json=?, status=?, updated_at=datetime('now') WHERE id=?",
        (json.dumps(result.model_dump()), IncidentStatus.PLANNED.value, incident_id),
    )
    _timeline(
        db,
        incident_id,
        IncidentStatus.PLANNED.value,
        "diagnose" if result.diagnosis_mode == "rule" else "ai",
        f"Root cause: {result.root_cause[:120]} (confidence={result.confidence:.2f})",
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "diagnosis_complete",
                "incident_id": incident_id,
                "diagnosis": result.model_dump(),
            }
        )

    return result


@router.post("/{incident_id}/plan", response_model=PlannerOutput)
async def plan_incident(
    incident_id: str,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    row = _get_incident_row(db, incident_id)
    current = IncidentStatus(row["status"])
    if current not in {IncidentStatus.PLANNED, IncidentStatus.DIAGNOSING, IncidentStatus.OPEN}:
        raise HTTPException(status_code=400, detail={"error": "invalid_state", "status": current.value})

    snapshot = _snapshot(db, incident_id)
    if not row["diagnosis_json"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "diagnosis_missing", "message": "Run POST /diagnose before /plan"},
        )
    diagnosis = DiagnosisPayload(**json.loads(row["diagnosis_json"]))

    governor = TokenGovernor(
        model_name=settings.llm_model_primary,
        budget_cap_per_incident=settings.budget_cap_per_incident_usd,
        budget_cap_per_run=settings.budget_cap_per_run_usd,
    )
    planner = PlannerAgent(token_governor=governor, db=db)
    result = planner.run(diagnosis, snapshot)

    needs_approval = any(action.approval_required for action in result.actions)
    new_status = IncidentStatus.PENDING_APPROVAL if needs_approval else IncidentStatus.PLANNED

    db.execute(
        "UPDATE incidents SET plan_json=?, status=?, planned_at=datetime('now'), updated_at=datetime('now') WHERE id=?",
        (json.dumps(result.model_dump()), new_status.value, incident_id),
    )
    _timeline(
        db,
        incident_id,
        new_status.value,
        "planner",
        f"{len(result.actions)} action(s) ranked. Approval needed: {needs_approval}",
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "plan_ready",
                "incident_id": incident_id,
                "plan": result.model_dump(),
            }
        )

    return result


@router.post("/{incident_id}/simulate")
def simulate_plan_action(
    incident_id: str,
    body: dict,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    snapshot = _snapshot(db, incident_id)
    row = _get_incident_row(db, incident_id)
    if not row["plan_json"]:
        raise HTTPException(status_code=400, detail={"error": "plan_missing"})

    plan = json.loads(row["plan_json"])
    index = body.get("action_index", 0)
    if not isinstance(index, int) or index < 0 or index >= len(plan.get("actions", [])):
        raise HTTPException(status_code=400, detail={"error": "invalid_action_index"})

    action = plan["actions"][index]
    simulation = simulate_action(action, snapshot)

    # Persist fresh simulation result back into plan_json for consistency.
    plan["actions"][index]["simulation_result"] = simulation
    db.execute(
        "UPDATE incidents SET plan_json=?, updated_at=datetime('now') WHERE id=?",
        (json.dumps(plan), incident_id),
    )
    _timeline(db, incident_id, row["status"], "planner", f"Simulation refreshed for action #{index}")
    db.commit()

    return {"action_index": index, "simulation_result": simulation}


@router.post("/{incident_id}/approve")
async def approve_action(
    incident_id: str,
    body: ApprovalRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    row = _get_incident_row(db, incident_id)
    current = IncidentStatus(row["status"])
    if current not in {IncidentStatus.PENDING_APPROVAL, IncidentStatus.PLANNED}:
        raise HTTPException(status_code=400, detail={"error": "invalid_state", "status": current.value})

    if not row["plan_json"]:
        raise HTTPException(status_code=400, detail={"error": "plan_missing"})

    if not body.approved:
        db.execute(
            "UPDATE incidents SET status=?, updated_at=datetime('now') WHERE id=?",
            (IncidentStatus.FAILED.value, incident_id),
        )
        _timeline(db, incident_id, IncidentStatus.FAILED.value, "operator", f"Action rejected: {body.operator_note}")
        db.commit()
        return {
            "incident_id": incident_id,
            "approved": False,
            "status": IncidentStatus.FAILED.value,
            "close_reason": "Operator rejected all proposed actions",
        }

    plan = json.loads(row["plan_json"])
    if body.action_index < 0 or body.action_index >= len(plan.get("actions", [])):
        raise HTTPException(status_code=400, detail={"error": "invalid_action_index"})

    db.execute(
        """UPDATE incidents
           SET status=?, approved_action_index=?, approved_by=?, approval_note=?,
               approved_at=datetime('now'), updated_at=datetime('now')
           WHERE id=?""",
        (
            IncidentStatus.EXECUTING.value,
            body.action_index,
            body.operator_id,
            body.operator_note,
            incident_id,
        ),
    )
    _timeline(
        db,
        incident_id,
        IncidentStatus.EXECUTING.value,
        "operator",
        f"Approved action #{body.action_index} by {body.operator_id}. {body.operator_note}",
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "status_change",
                "incident_id": incident_id,
                "previous_status": current.value,
                "new_status": IncidentStatus.EXECUTING.value,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )

    return {
        "incident_id": incident_id,
        "action_index": body.action_index,
        "approved": True,
        "status": IncidentStatus.EXECUTING.value,
        "message": "Action approved and execution started",
    }


@router.post("/{incident_id}/execute")
async def execute_action(
    incident_id: str,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    row = _get_incident_row(db, incident_id)
    if not row["plan_json"]:
        raise HTTPException(status_code=400, detail={"error": "plan_missing"})

    plan = json.loads(row["plan_json"])
    action_index = row["approved_action_index"] if row["approved_action_index"] is not None else 0
    if action_index < 0 or action_index >= len(plan.get("actions", [])):
        raise HTTPException(status_code=400, detail={"error": "invalid_action_index"})

    action_command = plan["actions"][action_index]["action"]
    executor_agent = ExecutorAgent(vcluster_mgr=VClusterManager(), action_runner=ActionRunner())
    result = await executor_agent.execute(incident_id=incident_id, action_command=action_command)

    next_status = IncidentStatus.VERIFYING if result.status.value == "success" else IncidentStatus.FAILED
    db.execute(
        "UPDATE incidents SET execution_json=?, status=?, executed_at=datetime('now'), updated_at=datetime('now') WHERE id=?",
        (json.dumps(result.model_dump()), next_status.value, incident_id),
    )
    _timeline(
        db,
        incident_id,
        next_status.value,
        "executor",
        f"Execution status={result.status.value}, sandbox_validated={result.sandbox_validated}",
    )
    db.commit()

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        await broadcaster.broadcast(
            {
                "type": "execution_update",
                "incident_id": incident_id,
                "execution": result.model_dump(),
            }
        )

    return result


@router.post("/{incident_id}/verify")
async def verify_incident(
    incident_id: str,
    request: Request,
    db: sqlite3.Connection = Depends(get_db_dep),
):
    row = _get_incident_row(db, incident_id)
    if not row["snapshot_json"]:
        raise HTTPException(status_code=400, detail={"error": "snapshot_missing"})

    snapshot = IncidentSnapshot(**json.loads(row["snapshot_json"]))
    checker = RecoveryChecker()
    verification = await checker.check_recovery(snapshot, window_seconds=settings.verification_window_seconds)

    new_status = IncidentStatus.RESOLVED if verification.recovered else IncidentStatus.FAILED
    resolved_at = datetime.utcnow().isoformat() + "Z" if verification.recovered else None
    db.execute(
        """UPDATE incidents
           SET verification_json=?, status=?, verified_at=datetime('now'), resolved_at=?, updated_at=datetime('now')
           WHERE id=?""",
        (json.dumps(verification.model_dump()), new_status.value, resolved_at, incident_id),
    )
    _timeline(db, incident_id, new_status.value, "verifier", verification.close_reason)

    if verification.recovered and row["diagnosis_json"] and row["execution_json"]:
        diagnosis = DiagnosisPayload(**json.loads(row["diagnosis_json"]))
        execution = json.loads(row["execution_json"])
        memory = IncidentMemoryStore(db)
        memory.write(
            incident_id=incident_id,
            snapshot=snapshot,
            diagnosis=diagnosis,
            selected_fix=execution.get("action", "unknown"),
            outcome="success",
            recovery_seconds=settings.verification_window_seconds,
        )

    db.commit()

    token_row = db.execute(
        "SELECT SUM(input_tokens), SUM(output_tokens), COUNT(*), SUM(actual_cost_usd), MAX(fallback_triggered) "
        "FROM token_usage WHERE incident_id=?",
        (incident_id,),
    ).fetchone()
    token_summary = {
        "total_input_tokens": token_row[0] or 0,
        "total_output_tokens": token_row[1] or 0,
        "total_ai_calls": token_row[2] or 0,
        "total_actual_cost_usd": round(token_row[3] or 0.0, 6),
        "rule_only_resolution": (token_row[2] or 0) == 0,
        "fallback_triggered": bool(token_row[4] or 0),
    }

    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is not None:
        if verification.recovered:
            await broadcaster.broadcast(
                {
                    "type": "incident_resolved",
                    "incident_id": incident_id,
                    "verification": verification.model_dump(),
                    "token_summary": token_summary,
                }
            )
        else:
            await broadcaster.broadcast(
                {
                    "type": "status_change",
                    "incident_id": incident_id,
                    "previous_status": row["status"],
                    "new_status": IncidentStatus.FAILED.value,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
            )

    return verification
