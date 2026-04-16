from datetime import datetime, timezone
import math
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, HTTPException

from agents.phase3_orchestrator import collect_monitor_snapshot, diagnose_snapshot
from agents.executor_agent import ExecutorAgent
from executor.action_runner import ActionRunner
from executor.vcluster_manager import VClusterManager
from planner.plan_simulator import simulate_action
from planner.planner_agent import PlannerAgent
from verifier.recovery_checker import RecoveryChecker
from incident.store import INCIDENTS
from realtime.hub import BROADCASTER

router = APIRouter(prefix="/incidents", tags=["incidents"])
planner_agent = PlannerAgent()
executor_agent = ExecutorAgent(VClusterManager(), ActionRunner())
recovery_checker = RecoveryChecker()


def _find_incident(incident_id: str) -> dict[str, Any]:
    """Return the in-memory incident record for the requested incident ID."""
    for incident in INCIDENTS:
        if incident["incident_id"] == incident_id:
            return incident
    raise HTTPException(status_code=404, detail="Incident not found")


def _parse_action_index(payload: dict[str, Any]) -> int:
    try:
        return int(payload.get("action_index", 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="action_index must be a valid integer") from exc


def _parse_window_seconds(payload: dict[str, Any]) -> int:
    try:
        value = int(payload.get("window_seconds", 120))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="window_seconds must be a valid integer") from exc

    if value <= 0:
        raise HTTPException(status_code=400, detail="window_seconds must be greater than 0")
    return value


def _coerce_percent(value: Any, *, required: bool) -> str:
    if value is None:
        if required:
            raise HTTPException(status_code=400, detail="metric values must be valid percentages")
        return "0%"

    text = str(value).strip()
    if not text:
        if required:
            raise HTTPException(status_code=400, detail="metric values must be valid percentages")
        return "0%"

    if text.endswith("%"):
        text = text[:-1].strip()
        if not text:
            raise HTTPException(status_code=400, detail="metric values must be valid percentages")

    try:
        numeric = float(text)
        if not math.isfinite(numeric):
            raise HTTPException(status_code=400, detail="metric values must be valid percentages")
        if numeric < 0:
            raise HTTPException(status_code=400, detail="metric values must be non-negative percentages")
        return f"{math.floor(numeric)}%"
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="metric values must be valid percentages") from exc


def _build_verifier_snapshot(incident: dict[str, Any], payload: dict[str, Any]) -> Any:
    request_metrics = payload.get("metrics")
    if request_metrics is not None:
        if not isinstance(request_metrics, dict):
            raise HTTPException(status_code=400, detail="metrics must be an object")

        has_memory = "memory" in request_metrics or "memory_pct" in request_metrics
        has_cpu = "cpu" in request_metrics or "cpu_pct" in request_metrics
        if not has_memory or not has_cpu:
            raise HTTPException(
                status_code=400,
                detail="metrics must include memory/memory_pct and cpu/cpu_pct",
            )

        memory = request_metrics.get("memory")
        if memory is None:
            memory = request_metrics.get("memory_pct")

        cpu = request_metrics.get("cpu")
        if cpu is None:
            cpu = request_metrics.get("cpu_pct")

        return SimpleNamespace(
            metrics=SimpleNamespace(
                memory=_coerce_percent(memory, required=True),
                cpu=_coerce_percent(cpu, required=True),
            )
        )

    snapshot_metrics = incident.get("snapshot", {}).get("metrics", {})
    memory = snapshot_metrics.get("memory")
    if memory is None:
        memory = snapshot_metrics.get("memory_pct", 0)

    cpu = snapshot_metrics.get("cpu")
    if cpu is None:
        cpu = snapshot_metrics.get("cpu_pct", 0)

    return SimpleNamespace(
        metrics=SimpleNamespace(
            memory=_coerce_percent(memory, required=False),
            cpu=_coerce_percent(cpu, required=False),
        )
    )


@router.get("")
def list_incidents() -> list[dict]:
    """Return all in-memory incidents for the demo API."""
    return INCIDENTS


@router.get("/{incident_id}")
def get_incident(incident_id: str) -> dict:
    """Return the incident detail payload for a single incident."""
    incident = _find_incident(incident_id)

    # Frontend expects `plan`; older flows only populate `plan_json`.
    if incident.get("plan") is None and incident.get("plan_json") is not None:
        incident["plan"] = incident["plan_json"]

    return incident


@router.post("/{incident_id}/diagnose")
async def diagnose_incident(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run diagnosis for a specific incident and persist it on the incident record."""
    incident = _find_incident(incident_id)
    body = payload or {}

    snapshot = body.get("snapshot") or incident.get("snapshot") or collect_monitor_snapshot()
    diagnosis = diagnose_snapshot(snapshot)

    previous_status = incident.get("status", "open")
    incident["snapshot"] = snapshot
    incident["diagnosis"] = diagnosis
    incident["updated_at"] = datetime.now(timezone.utc).isoformat()
    incident["status"] = "diagnosing"

    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": previous_status,
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )
    await BROADCASTER.broadcast(
        {
            "type": "diagnosis_complete",
            "incident_id": incident_id,
            "diagnosis": diagnosis,
        }
    )

    return diagnosis


@router.get("/{incident_id}/timeline")
def get_incident_timeline(incident_id: str) -> dict[str, Any]:
    """Return a synthetic timeline from persisted incident lifecycle timestamps."""
    incident = _find_incident(incident_id)

    events: list[dict[str, Any]] = []

    created_at = incident.get("created_at")
    if created_at:
        events.append(
            {
                "timestamp": created_at,
                "status": "open",
                "actor": "monitor",
                "note": incident.get("summary", "Incident opened"),
            }
        )

    if incident.get("diagnosis") is not None:
        events.append(
            {
                "timestamp": incident.get("updated_at") or created_at,
                "status": "diagnosing",
                "actor": "diagnose-agent",
                "note": "Diagnosis generated",
            }
        )

    if incident.get("planned_at"):
        events.append(
            {
                "timestamp": incident.get("planned_at"),
                "status": incident.get("status", "planned"),
                "actor": "planner-agent",
                "note": "Remediation plan generated",
            }
        )

    if incident.get("execution") is not None:
        events.append(
            {
                "timestamp": incident.get("execution", {}).get("execution_timestamp")
                or incident.get("updated_at")
                or created_at,
                "status": "executing",
                "actor": "executor-agent",
                "note": "Execution attempted",
            }
        )

    if incident.get("verification") is not None:
        events.append(
            {
                "timestamp": incident.get("verified_at") or incident.get("updated_at") or created_at,
                "status": "verifying",
                "actor": "verifier-agent",
                "note": "Verification completed",
            }
        )

    if incident.get("resolved_at"):
        events.append(
            {
                "timestamp": incident.get("resolved_at"),
                "status": "resolved",
                "actor": "system",
                "note": "Incident resolved",
            }
        )

    events.sort(key=lambda item: str(item.get("timestamp", "")))
    return {"incident_id": incident_id, "events": events}


@router.post("/{incident_id}/plan")
async def plan_incident(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generate and persist a plan for the incident using the planner agent."""
    incident = _find_incident(incident_id)
    body = payload or {}

    context = dict(incident.get("scope", {}))
    context.update(body.get("context", {}))
    context["dependency_graph_summary"] = body.get(
        "dependency_graph_summary",
        incident.get("dependency_graph_summary", ""),
    )
    context["has_rollback_revision"] = body.get("has_rollback_revision", True)

    # Persist planner context used for downstream simulation calls.
    incident["dependency_graph_summary"] = context["dependency_graph_summary"]

    snapshot = body.get("snapshot") or collect_monitor_snapshot()
    diagnosis = body.get("diagnosis") or diagnose_snapshot(snapshot)
    incident["snapshot"] = snapshot

    plan_output = planner_agent.run(
        diagnosis=diagnosis,
        snapshot={
            "dependency_graph_summary": context["dependency_graph_summary"],
            "has_rollback_revision": context["has_rollback_revision"],
        },
        context=context,
    )

    actions = [action.model_dump(mode="json") for action in plan_output.actions]
    incident["diagnosis"] = diagnosis
    incident["plan_json"] = {"actions": actions}
    incident["plan"] = incident["plan_json"]
    incident["planned_at"] = datetime.now(timezone.utc).isoformat()

    previous_status = incident.get("status", "open")
    if any(action["approval_required"] for action in actions):
        incident["status"] = "pending_approval"
    else:
        incident["status"] = "planned"

    incident["updated_at"] = datetime.now(timezone.utc).isoformat()

    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": previous_status,
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )
    await BROADCASTER.broadcast(
        {
            "type": "plan_ready",
            "incident_id": incident_id,
            "plan": incident["plan_json"],
        }
    )

    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "plan": incident["plan_json"],
    }


@router.post("/{incident_id}/simulate")
def simulate_incident_action(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Recompute the simulation result for a planned action."""
    incident = _find_incident(incident_id)
    if "plan_json" not in incident or not incident["plan_json"].get("actions"):
        raise HTTPException(status_code=400, detail="No plan available. Run /plan first.")

    body = payload or {}
    action_index = _parse_action_index(body)

    actions = incident["plan_json"]["actions"]

    if action_index < 0 or action_index >= len(actions):
        raise HTTPException(status_code=400, detail="Invalid action_index")

    action = actions[action_index]
    simulated = simulate_action(
        {
            "command": action["action"],
            "risk": action["risk_level"],
            "approval_required": action["approval_required"],
        },
        {
            "dependency_graph_summary": incident.get("dependency_graph_summary", ""),
            "has_rollback_revision": bool(body.get("has_rollback_revision", True)),
        },
    )
    action["simulation_result"] = simulated.model_dump(mode="json")

    return {
        "incident_id": incident_id,
        "action_index": action_index,
        "simulation_result": action["simulation_result"],
    }


@router.post("/{incident_id}/approve")
async def approve_incident_action(incident_id: str) -> dict:
    """Mark the incident as approved so the next execution stage can proceed."""
    incident = _find_incident(incident_id)

    if incident.get("status") not in {"planned", "pending_approval"}:
        raise HTTPException(
            status_code=400,
            detail="Incident must be in planned or pending_approval state before approval",
        )

    previous_status = incident.get("status", "open")
    incident["status"] = "approved"
    incident["updated_at"] = datetime.now(timezone.utc).isoformat()

    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": previous_status,
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )

    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "message": "Approval accepted. Execute the approved action next.",
    }


@router.post("/{incident_id}/execute")
async def execute_incident_action(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Execute an approved action through sandbox and production flow."""
    incident = _find_incident(incident_id)
    body = payload or {}

    if incident.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Incident must be approved before execution")

    if "plan_json" not in incident or not incident["plan_json"].get("actions"):
        raise HTTPException(status_code=400, detail="No plan available. Run /plan first.")

    actions = incident["plan_json"]["actions"]
    action_index = _parse_action_index(body)
    if action_index < 0 or action_index >= len(actions):
        raise HTTPException(status_code=400, detail="Invalid action_index")

    action = actions[action_index]
    command = str(action.get("action", ""))

    previous_status = incident.get("status", "open")
    incident["status"] = "executing"
    incident["updated_at"] = datetime.now(timezone.utc).isoformat()

    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": previous_status,
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )

    execution_result = await executor_agent.execute(incident_id=incident_id, action_command=command)
    incident["execution"] = execution_result.model_dump(mode="json")

    if execution_result.status.value == "success":
        incident["status"] = "verifying"
    else:
        incident["status"] = "failed"

    incident["updated_at"] = datetime.now(timezone.utc).isoformat()

    await BROADCASTER.broadcast(
        {
            "type": "execution_update",
            "incident_id": incident_id,
            "execution": incident["execution"],
        }
    )
    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": "executing",
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )

    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "execution": incident["execution"],
    }


@router.post("/{incident_id}/verify")
async def verify_incident_recovery(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Verify recovery thresholds and close the incident as resolved or failed."""
    incident = _find_incident(incident_id)
    if incident.get("status") != "verifying":
        raise HTTPException(status_code=400, detail="Incident must be in verifying state before verification")

    body = payload or {}
    window_seconds = _parse_window_seconds(body)
    snapshot = _build_verifier_snapshot(incident, body)

    verification = await recovery_checker.check_recovery(snapshot=snapshot, window_seconds=window_seconds)
    incident["verification"] = verification.model_dump(mode="json")
    incident["verified_at"] = datetime.now(timezone.utc).isoformat()

    previous_status = incident.get("status", "verifying")
    if verification.recovered:
        incident["status"] = "resolved"
        incident["resolved_at"] = incident["verified_at"]
    else:
        incident["status"] = "failed"

    incident["updated_at"] = datetime.now(timezone.utc).isoformat()

    await BROADCASTER.broadcast(
        {
            "type": "status_change",
            "incident_id": incident_id,
            "previous_status": previous_status,
            "new_status": incident["status"],
            "timestamp": incident["updated_at"],
        }
    )

    if incident["status"] == "resolved":
        await BROADCASTER.broadcast(
            {
                "type": "incident_resolved",
                "incident_id": incident_id,
                "verification": incident["verification"],
                "token_summary": incident.get("token_summary")
                or {
                    "total_input_tokens": 0,
                    "total_output_tokens": 0,
                    "total_ai_calls": 0,
                    "total_actual_cost_usd": 0.0,
                    "rule_only_resolution": True,
                    "fallback_triggered": False,
                },
            }
        )

    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "verification": incident["verification"],
    }
