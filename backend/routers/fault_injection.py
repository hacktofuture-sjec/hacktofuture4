from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException

from db import get_db
from agents.live_monitor_agent import LIVE_MONITOR_AGENT
from fault_injection.fault_injector import FaultInjector
from models.schemas import FaultInjectionRequest, FaultInjectionResponse

router = APIRouter(tags=["fault-injection"])


@router.post("/inject-fault")
async def inject_fault(body: FaultInjectionRequest) -> FaultInjectionResponse:
    db = get_db()
    try:
        row = db.execute(
            "SELECT scenario_json FROM scenarios WHERE scenario_id = ?",
            (body.scenario_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail={"error": "scenario_not_found"})

        scenario = json.loads(row["scenario_json"])
    finally:
        db.close()

    injector = FaultInjector([scenario])
    effective_force = body.force or body.scenario_id == "cpu-spike-001"
    try:
        injector.apply_fault(body.scenario_id, force=effective_force)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail={"error": "fault_injection_failed", "reason": str(exc)})

    # Keep incident creation monitor-driven, but nudge an immediate detection cycle
    # so the user does not need to wait for the next poll interval.
    try:
        asyncio.create_task(LIVE_MONITOR_AGENT.run_cycle_once())
    except Exception:
        pass

    return FaultInjectionResponse(
        status="injected",
        scenario_id=body.scenario_id,
        command_applied=str(scenario.get("k8s_fault_action", "")),
    )
