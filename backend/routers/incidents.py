from datetime import datetime, timezone
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

router = APIRouter(prefix="/incidents", tags=["incidents"])
planner_agent = PlannerAgent()
executor_agent = ExecutorAgent(VClusterManager(), ActionRunner())
recovery_checker = RecoveryChecker()

INCIDENTS: list[dict] = [
    {
        "incident_id": "inc-001",
        "service": "payment-api",
        "status": "open",
        "failure_class": "resource",
        "scope": {"namespace": "default", "deployment": "payment-api"},
        "dependency_graph_summary": "frontend -> payment-api -> db",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
]


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


def _coerce_percent(value: Any) -> str:
    text = str(value).strip()
    if not text:
        return "0%"
    if text.endswith("%"):
        return text
    try:
        numeric = float(text)
        return f"{numeric:.0f}%"
    except ValueError:
        return "0%"


def _build_verifier_snapshot(incident: dict[str, Any], payload: dict[str, Any]) -> Any:
    metrics = payload.get("metrics") or incident.get("snapshot", {}).get("metrics", {})
    memory = metrics.get("memory")
    if memory is None:
        memory = metrics.get("memory_pct", 0)

    cpu = metrics.get("cpu")
    if cpu is None:
        cpu = metrics.get("cpu_pct", 0)

    return SimpleNamespace(metrics=SimpleNamespace(memory=_coerce_percent(memory), cpu=_coerce_percent(cpu)))


@router.get("")
def list_incidents() -> list[dict]:
    """Return all in-memory incidents for the demo API."""
    return INCIDENTS


@router.get("/{incident_id}")
def get_incident(incident_id: str) -> dict:
    """Return the incident detail payload for a single incident."""
    return _find_incident(incident_id)


@router.post("/{incident_id}/plan")
def plan_incident(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
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
    incident["planned_at"] = datetime.now(timezone.utc).isoformat()

    if any(action["approval_required"] for action in actions):
        incident["status"] = "pending_approval"
    else:
        incident["status"] = "planned"

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
def approve_incident_action(incident_id: str) -> dict:
    """Mark the incident as approved so the next execution stage can proceed."""
    incident = _find_incident(incident_id)

    if incident.get("status") == "failed":
        raise HTTPException(status_code=400, detail="Incident already closed as failed")

    incident["status"] = "approved"
    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "message": "Approval accepted. Executor integration is next.",
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

    incident["status"] = "executing"
    execution_result = await executor_agent.execute(incident_id=incident_id, action_command=command)
    incident["execution"] = execution_result.model_dump(mode="json")

    if execution_result.status.value == "success":
        incident["status"] = "verifying"
    else:
        incident["status"] = "failed"

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
    window_seconds = int(body.get("window_seconds", 120))
    snapshot = _build_verifier_snapshot(incident, body)

    verification = await recovery_checker.check_recovery(snapshot=snapshot, window_seconds=window_seconds)
    incident["verification"] = verification.model_dump(mode="json")
    incident["verified_at"] = datetime.now(timezone.utc).isoformat()

    if verification.recovered:
        incident["status"] = "resolved"
        incident["resolved_at"] = incident["verified_at"]
    else:
        incident["status"] = "failed"

    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "verification": incident["verification"],
    }
