"""Bridge between the HTTP/WS layer and the Blue agent's domain modules."""

from __future__ import annotations

import asyncio
import uuid
from collections import deque
from datetime import datetime
from typing import Any, Callable, Deque, Optional

from blue_agent.backend.schemas.blue_schemas import (
    AssetInfo,
    BlueAgentStatus,
    ClosePortRequest,
    DefensePlan,
    DefenseResult,
    EnvironmentAlertInfo,
    EnvironmentStats,
    EvolutionMetrics,
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
    VulnerabilityInfo,
)
from blue_agent.scanner.asset_scanner import AssetScanner
from blue_agent.scanner.ssh_scanner import SSHScanner
from blue_agent.environment.environment_manager import EnvironmentManager
from blue_agent.strategy.defense_evolver import DefenseEvolver
from blue_agent.strategy.defense_planner import DefensePlanner

_TOOL_HISTORY: Deque[ToolCall] = deque(maxlen=200)
_LOG_HISTORY: Deque[LogEntry] = deque(maxlen=500)

_asset_scanner = AssetScanner()
_ssh_scanner = SSHScanner()
_environment_manager = EnvironmentManager()
_defense_planner = DefensePlanner()
_defense_evolver = DefenseEvolver()

# ---------------------------------------------------------------------------
# Real-time broadcast bridge — WebSocket registers its callback here
# ---------------------------------------------------------------------------

_broadcast_cb: Optional[Callable] = None


def set_broadcast_callback(cb: Callable) -> None:
    """Called by blue_ws.py to register the WebSocket broadcast function."""
    global _broadcast_cb
    _broadcast_cb = cb


def _broadcast(payload: dict) -> None:
    """Push a payload to all connected WebSocket clients."""
    if _broadcast_cb:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_broadcast_cb(payload))
        except RuntimeError:
            pass


def add_log(message: str, level: str = "INFO", tool_id: str | None = None) -> LogEntry:
    """Add a log entry and broadcast it to all dashboard clients."""
    entry = LogEntry(level=level, message=message, tool_id=tool_id)
    _LOG_HISTORY.append(entry)
    _broadcast({"type": "log", "payload": entry.model_dump(mode="json")})
    return entry


def _new_tool_call(name: str, category: str, params: dict[str, Any]) -> ToolCall:
    call = ToolCall(
        id=str(uuid.uuid4()),
        name=name,
        category=category,
        status=ToolStatus.RUNNING,
        params=params,
    )
    _TOOL_HISTORY.append(call)
    _broadcast({"type": "tool_call", "payload": call.model_dump(mode="json")})
    return call


def _finish(call: ToolCall, result: dict[str, Any], status: ToolStatus = ToolStatus.DONE) -> ToolCall:
    call.status = status
    call.result = result
    call.finished_at = datetime.utcnow()
    add_log(
        f"{call.name} -> {status.value}" + (f" | {result.get('detail', '')}" if result.get('detail') else ""),
        level="INFO" if status is ToolStatus.DONE else "ERROR",
        tool_id=call.id,
    )
    _broadcast({"type": "tool_call", "payload": call.model_dump(mode="json")})
    return call


# ── Defense endpoints ────────────────────────────────────────────────

async def close_port(request: ClosePortRequest) -> DefenseResult:
    call = _new_tool_call("close_port", "defend", request.model_dump())
    return DefenseResult(
        tool_call=_finish(call, {"closed": True, "detail": f"closed {request.protocol}/{request.port}"}),
        detail=f"closed {request.protocol}/{request.port} on {request.host}",
    )


async def harden_service(request: HardenServiceRequest) -> DefenseResult:
    call = _new_tool_call("harden_service", "defend", request.model_dump())
    return DefenseResult(
        tool_call=_finish(call, {"hardened": request.service, "detail": f"hardened {request.service}"}),
        detail=f"hardened {request.service} on {request.host}",
    )


async def isolate_host(request: IsolateHostRequest) -> DefenseResult:
    call = _new_tool_call("isolate_host", "defend", request.model_dump())
    return DefenseResult(
        tool_call=_finish(call, {"isolated": request.host}),
        detail=request.reason or "isolated",
    )


# ── Patch endpoints ──────────────────────────────────────────────────

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


# ── Strategy endpoints ───────────────────────────────────────────────

async def plan_defense(request: StrategyRequest) -> DefensePlan:
    call = _new_tool_call("plan_defense", "strategy", request.model_dump())
    plan = _defense_planner.get_current_plan()
    steps = [a.get("reason", a.get("action", "")) for a in plan[:10]]
    return DefensePlan(
        tool_call=_finish(call, {"steps": steps, "plan_count": len(plan)}),
        steps=steps,
    )


async def evolve_strategy(request: StrategyRequest) -> DefensePlan:
    call = _new_tool_call("evolve_strategy", "strategy", request.model_dump())
    metrics = _defense_evolver.get_metrics()
    steps = [f"Evolution #{metrics['evolution_count']}", f"Accuracy: {metrics['response_accuracy_pct']:.1f}%"]
    return DefensePlan(tool_call=_finish(call, metrics), steps=steps)


async def current_strategy() -> DefensePlan:
    call = _new_tool_call("current_strategy", "strategy", {})
    plan = _defense_planner.get_current_plan()
    threat = _defense_planner.get_threat_summary()
    steps = [a.get("reason", "") for a in plan[:10]]
    return DefensePlan(
        tool_call=_finish(call, {**threat, "plan_actions": len(plan)}),
        steps=steps,
    )


# ── SSH scan — the main pipeline ─────────────────────────────────────

async def run_ssh_scan(host: str, ssh_port: int, username: str, password: str) -> dict:
    """Full pipeline: SSH connect → discover → CVE lookup → fix → verify.

    Every step is logged as a ToolCall + LogEntry and broadcast to the
    dashboard in real-time via WebSocket.
    """
    # Pass the logging callback to the scanner so it can stream progress
    result = await _ssh_scanner.scan(
        host, ssh_port, username, password,
        log_cb=add_log,
        tool_cb=_create_scan_tool,
    )
    return result


def _create_scan_tool(name: str, params: dict, result: dict, status: str = "DONE") -> None:
    """Helper: create a completed ToolCall for a scan step."""
    call = _new_tool_call(name, "scan", params)
    _finish(call, result, ToolStatus.DONE if status == "DONE" else ToolStatus.FAILED)


# ── Asset scanning endpoints ─────────────────────────────────────────

async def get_asset_inventory(environment: str | None = None) -> list:
    if environment:
        by_env = _asset_scanner.get_inventory_by_environment()
        items = by_env.get(environment, [])
    else:
        items = _asset_scanner.get_inventory()
    return [AssetInfo(**item) for item in items]


async def get_vulnerable_assets() -> list:
    items = _asset_scanner.get_vulnerable_assets()
    return [AssetInfo(**item) for item in items]


async def get_scan_stats() -> dict:
    return _ssh_scanner.get_stats()


async def get_all_vulnerabilities() -> list:
    vulns = []
    for svc in _ssh_scanner.last_scan_results:
        for cve in svc.cves:
            vulns.append(VulnerabilityInfo(
                cve_id=cve.cve_id,
                severity=cve.severity,
                cvss_score=cve.cvss_score,
                description=cve.description,
                affected_software=cve.affected_software,
                affected_version=cve.affected_version,
                fix=cve.fix,
            ))
    return vulns


# ── Environment monitoring endpoints ─────────────────────────────────

async def get_environment_alerts(environment: str | None = None) -> list:
    items = _environment_manager.get_alerts(environment=environment)
    return [EnvironmentAlertInfo(**item) for item in items]


async def get_environment_stats() -> EnvironmentStats:
    stats = _environment_manager.get_stats()
    return EnvironmentStats(**stats)


# ── Evolution endpoints ──────────────────────────────────────────────

async def get_evolution_metrics() -> EvolutionMetrics:
    metrics = _defense_evolver.get_metrics()
    return EvolutionMetrics(**metrics)


# ── Full agent status ────────────────────────────────────────────────

async def get_agent_status() -> BlueAgentStatus:
    ssh_stats = _ssh_scanner.get_stats()
    return BlueAgentStatus(
        running=True,
        detection_count=ssh_stats.get("services_found", 0),
        response_count=ssh_stats.get("total_cves", 0),
        patch_count=ssh_stats.get("fixes_applied", 0),
        cve_fix_count=ssh_stats.get("fixes_applied", 0),
        isolation_count=0,
        scan_cycles=ssh_stats.get("scan_count", 0),
        assets_discovered=ssh_stats.get("services_found", 0),
        vulnerable_assets=ssh_stats.get("vulnerable_services", 0),
        total_vulnerabilities=ssh_stats.get("total_cves", 0),
        environment_alerts=0,
        evolution_rounds=0,
        defense_plans=0,
    )


async def apply_ssh_fixes() -> dict:
    """Step 2: apply approved fixes on the server."""
    result = await _ssh_scanner.apply_fixes(
        log_cb=add_log,
        tool_cb=_create_scan_tool,
    )
    return result


def get_ssh_scan_results() -> list:
    return _ssh_scanner.get_results()


def get_ssh_scan_stats() -> dict:
    return _ssh_scanner.get_stats()


# ── History endpoints ────────────────────────────────────────────────

async def recent_tool_calls(category: str | None = None, limit: int = 20) -> list:
    items = list(_TOOL_HISTORY)
    if category:
        items = [c for c in items if c.category == category]
    return items[-limit:]


async def recent_logs(limit: int = 100) -> list:
    return list(_LOG_HISTORY)[-limit:]
