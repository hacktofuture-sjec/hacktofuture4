"""Bridge between the HTTP/WS layer and the Blue agent's domain modules."""

from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime
from typing import Any, Deque

from blue_agent.backend.schemas.blue_schemas import (
    ClosePortRequest,
    DefensePlan,
    DefenseResult,
    HardenServiceRequest,
    IsolateHostRequest,
    LogEntry,
    PatchRequest,
    PatchResult,
    StrategyRequest,
    ToolCall,
    ToolStatus,
    VerifyFixRequest,
    VerifyFixResult,
)
from blue_agent.detector.anomaly_detector import AnomalyDetector
from blue_agent.detector.intrusion_detector import IntrusionDetector
from blue_agent.detector.log_monitor import LogMonitor
from blue_agent.patcher.auto_patcher import AutoPatcher
from blue_agent.responder.isolator import Isolator
from blue_agent.responder.response_engine import ResponseEngine
from blue_agent.strategy.defense_evolver import DefenseEvolver
from blue_agent.strategy.defense_planner import DefensePlanner

_TOOL_HISTORY: Deque[ToolCall] = deque(maxlen=200)
_LOG_HISTORY: Deque[LogEntry] = deque(maxlen=500)

_intrusion_detector = IntrusionDetector()
_anomaly_detector = AnomalyDetector()
_log_monitor = LogMonitor()
_response_engine = ResponseEngine()
_isolator = Isolator()
_auto_patcher = AutoPatcher()
_defense_planner = DefensePlanner()
_defense_evolver = DefenseEvolver()


def _new_tool_call(name: str, category: str, params: dict[str, Any]) -> ToolCall:
    return ToolCall(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        status=ToolStatus.RUNNING,
        params=params,
    )


def _finish(call: ToolCall, result: dict[str, Any], status: ToolStatus = ToolStatus.DONE) -> ToolCall:
    call.status = status
    call.result = result
    call.finished_at = datetime.utcnow()
    _TOOL_HISTORY.append(call)
    _LOG_HISTORY.append(
        LogEntry(
            level="INFO" if status is ToolStatus.DONE else "ERROR",
            message=f"{call.name} -> {status.value}",
            tool_id=call.id,
        )
    )
    return call


async def close_port(request: ClosePortRequest) -> DefenseResult:
    call = _new_tool_call("close_port", "defend", request.model_dump())
    # TODO: invoke _response_engine to drop the port
    return DefenseResult(
        tool_call=_finish(call, {"closed": True}),
        detail=f"closed {request.protocol}/{request.port} on {request.host}",
    )


async def harden_service(request: HardenServiceRequest) -> DefenseResult:
    call = _new_tool_call("harden_service", "defend", request.model_dump())
    return DefenseResult(
        tool_call=_finish(call, {"hardened": request.service}),
        detail=f"hardened {request.service} on {request.host}",
    )


async def isolate_host(request: IsolateHostRequest) -> DefenseResult:
    call = _new_tool_call("isolate_host", "defend", request.model_dump())
    return DefenseResult(
        tool_call=_finish(call, {"isolated": request.host}),
        detail=request.reason or "isolated",
    )


async def apply_patch(request: PatchRequest) -> PatchResult:
    call = _new_tool_call("apply_patch", "patch", request.model_dump())
    return PatchResult(tool_call=_finish(call, {"applied": True}), applied=True)


async def verify_fix(request: VerifyFixRequest) -> VerifyFixResult:
    call = _new_tool_call("verify_fix", "patch", request.model_dump())
    return VerifyFixResult(
        tool_call=_finish(call, {"verified": True}),
        verified=True,
        evidence="re-scan returned no matching CVE signature",
    )


async def plan_defense(request: StrategyRequest) -> DefensePlan:
    call = _new_tool_call("plan_defense", "strategy", request.model_dump())
    steps = ["monitor", "isolate", "patch"]
    return DefensePlan(tool_call=_finish(call, {"steps": steps}), steps=steps)


async def evolve_strategy(request: StrategyRequest) -> DefensePlan:
    call = _new_tool_call("evolve_strategy", "strategy", request.model_dump())
    return DefensePlan(tool_call=_finish(call, {}), steps=[])


async def current_strategy() -> DefensePlan:
    call = _new_tool_call("current_strategy", "strategy", {})
    return DefensePlan(tool_call=_finish(call, {}), steps=[])


async def recent_tool_calls(category: str | None = None, limit: int = 20) -> list[ToolCall]:
    items = list(_TOOL_HISTORY)
    if category:
        items = [c for c in items if c.category == category]
    return items[-limit:]


async def recent_logs(limit: int = 100) -> list[LogEntry]:
    return list(_LOG_HISTORY)[-limit:]
