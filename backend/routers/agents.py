from typing import Any

from fastapi import APIRouter

from agents.phase3_orchestrator import (
    collect_monitor_snapshot,
    diagnose_snapshot,
    plan_diagnosis,
    run_phase3_pipeline,
)

router = APIRouter(tags=["agents"])


@router.post("/monitor")
def monitor() -> dict[str, Any]:
    return {"status": "ok", "agent": "monitor", "snapshot": collect_monitor_snapshot()}


@router.post("/diagnose")
def diagnose(snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    monitor_snapshot = snapshot or collect_monitor_snapshot()
    diagnosis = diagnose_snapshot(monitor_snapshot)
    return {"status": "ok", "agent": "diagnose", "diagnosis": diagnosis}


@router.post("/plan")
def plan(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = payload or {}
    diagnosis = body.get("diagnosis")
    context = body.get("context")

    if diagnosis is None:
        snapshot = collect_monitor_snapshot()
        diagnosis = diagnose_snapshot(snapshot)

    plan_output = plan_diagnosis(diagnosis, context)
    return {"status": "ok", "agent": "planner", "plan": plan_output}


@router.post("/pipeline")
def pipeline(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    context = (payload or {}).get("context")
    result = run_phase3_pipeline(plan_context=context)
    return {"status": "ok", "agent": "phase3", **result}


@router.post("/execute")
def execute() -> dict[str, Any]:
    return {"status": "stub", "agent": "executor"}


@router.post("/verify")
def verify() -> dict[str, Any]:
    return {"status": "stub", "agent": "verifier"}
