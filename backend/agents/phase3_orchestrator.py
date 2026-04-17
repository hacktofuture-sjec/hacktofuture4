from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from agents.monitor_agent import MonitorAgent
from diagnosis.diagnose_agent import DiagnoseAgent
from diagnosis.rule_engine import match_fingerprint
from governance.token_governor import TokenGovernor
from models.schemas import EventRecord, IncidentScope, IncidentSnapshot, LogSignature, MetricSummary, TraceSummary
from planner.planner_agent import PlannerAgent
from planner.policy_ranker import lookup_policy


GLOBAL_MONITOR_AGENT = MonitorAgent()
GLOBAL_TOKEN_GOVERNOR = TokenGovernor()
GLOBAL_PLANNER_AGENT = PlannerAgent()


def _utc_now() -> str:
    """Return the current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _coerce_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Normalize legacy and nested monitor snapshots into the current shape."""
    if "metrics" in snapshot and "events" in snapshot and "logs_summary" in snapshot:
        return snapshot

    return {
        "metrics": {
            "memory_pct": snapshot.get("memory_pct", 0),
            "cpu_pct": snapshot.get("cpu_pct", 0),
            "restart_count": snapshot.get("restart_count", 0),
            "latency_delta": snapshot.get("latency_delta", 0),
        },
        "events": snapshot.get("events", snapshot.get("event_reason", [])),
        "logs_summary": snapshot.get("logs_summary", snapshot.get("log_signatures", [])),
        "trace": snapshot.get("trace", {}),
        "trace_summary": snapshot.get("trace_summary"),
    }


def _as_percent(value: Any, default: str = "0%") -> str:
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    if text.endswith("%"):
        return text
    try:
        return f"{int(float(text))}%"
    except Exception:
        return default


def _as_latency(value: Any, default: str = "1.0x") -> str:
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    if text.endswith("x"):
        return text
    try:
        return f"{float(text):.1f}x"
    except Exception:
        return default


def _snapshot_to_model(snapshot: dict[str, Any]) -> IncidentSnapshot:
    normalized = _coerce_snapshot(snapshot)
    metrics = normalized.get("metrics", {})
    events = normalized.get("events", []) or []
    logs_summary = normalized.get("logs_summary", []) or []
    trace = normalized.get("trace_summary") or normalized.get("trace")
    scope = normalized.get("scope") or snapshot.get("scope") or {"namespace": "default", "deployment": str(snapshot.get("service", "unknown"))}

    event_models = [EventRecord.model_validate(event) if isinstance(event, dict) else EventRecord(reason=str(event)) for event in events]
    log_models = [LogSignature.model_validate(signature) if isinstance(signature, dict) else LogSignature(signature=str(signature), count=1) for signature in logs_summary]
    trace_model = None
    if isinstance(trace, dict):
        required_trace_keys = {"suspected_path", "hot_span", "p95_ms"}
        if required_trace_keys.issubset(trace.keys()):
            trace_model = TraceSummary.model_validate(trace)

    return IncidentSnapshot(
        incident_id=str(normalized.get("incident_id") or snapshot.get("incident_id") or "monitor-snapshot"),
        alert=str(normalized.get("alert") or snapshot.get("alert") or f"{normalized.get('failure_class', 'unknown')} detected"),
        service=str(normalized.get("service") or snapshot.get("service") or "unknown"),
        pod=str(normalized.get("pod") or snapshot.get("pod") or "unknown"),
        metrics=MetricSummary(
            cpu=_as_percent(metrics.get("cpu") or metrics.get("cpu_pct")),
            memory=_as_percent(metrics.get("memory") or metrics.get("memory_pct")),
            restarts=int(metrics.get("restarts") or metrics.get("restart_count") or 0),
            latency_delta=_as_latency(metrics.get("latency_delta") or metrics.get("latency_delta_x") or metrics.get("latency_p95_seconds")),
        ),
        events=event_models,
        logs_summary=log_models,
        trace_summary=trace_model,
        scope=IncidentScope.model_validate(scope),
        monitor_confidence=float(normalized.get("monitor_confidence") or snapshot.get("monitor_confidence") or 0.0),
        failure_class=normalized.get("failure_class") or snapshot.get("failure_class") or "unknown",
        dependency_graph_summary=str(normalized.get("dependency_graph_summary") or snapshot.get("dependency_graph_summary") or f"{snapshot.get('service', 'unknown')} -> dependencies"),
    )


def collect_monitor_snapshot(monitor_agent: Optional[MonitorAgent] = None) -> dict[str, Any]:
    """Collect and normalize a monitor snapshot from the active agent."""
    agent = monitor_agent or GLOBAL_MONITOR_AGENT
    snapshot = _coerce_snapshot(agent.collect_snapshot())
    snapshot["collected_at"] = _utc_now()
    return snapshot


def diagnose_snapshot(
    snapshot: dict[str, Any],
    token_governor: Optional[TokenGovernor] = None,
    llm_api_url: Optional[str] = None,
    llm_model: str = "custom-api",
) -> dict[str, Any]:
    """Run rule-based diagnosis first and fall back to the LLM when allowed."""
    tg = token_governor or GLOBAL_TOKEN_GOVERNOR
    del llm_api_url, llm_model

    snapshot_model = _snapshot_to_model(snapshot)
    agent = DiagnoseAgent(tg, None)
    diagnosis = agent.run(snapshot_model).model_dump(mode="json")

    # Compatibility fields for legacy API consumers and planner policy lookup.
    fingerprint = match_fingerprint(snapshot_model)
    if fingerprint:
        diagnosis.setdefault("fingerprint_id", str(fingerprint.get("fingerprint_id")))
        diagnosis.setdefault("recommended_fix", str(fingerprint.get("recommended_fix", "")))

    diagnosis.setdefault(
        "source",
        "llm_fallback" if diagnosis.get("diagnosis_mode") == "ai" else "rule",
    )
    diagnosis.setdefault("diagnosed_at", _utc_now())
    return diagnosis


def plan_diagnosis(diagnosis: dict[str, Any], context: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Convert a diagnosis into a planner action set with backward-compatible fields."""
    ctx = context or {}
    snapshot = {
        "dependency_graph_summary": str(ctx.get("dependency_graph_summary", "")),
        "has_rollback_revision": bool(ctx.get("has_rollback_revision", True)),
    }

    planner_output = GLOBAL_PLANNER_AGENT.run(
        diagnosis=diagnosis,
        snapshot=snapshot,
        context=ctx,
    )

    fingerprint_id = diagnosis.get("fingerprint_id")
    planner_source = "policy_catalog" if lookup_policy(str(fingerprint_id), ctx) else "fallback"
    serialized_actions = []
    for action in planner_output.actions:
        payload = action.model_dump(mode="json")
        if "command" not in payload:
            payload["command"] = payload.get("action", "")
        serialized_actions.append(payload)

    return {
        "planner_source": planner_source,
        "fingerprint_id": fingerprint_id,
        "actions": serialized_actions,
        "planned_at": _utc_now(),
    }


def run_phase3_pipeline(
    monitor_agent: Optional[MonitorAgent] = None,
    token_governor: Optional[TokenGovernor] = None,
    plan_context: Optional[dict[str, Any]] = None,
    llm_api_url: Optional[str] = None,
    llm_model: str = "custom-api",
) -> dict[str, Any]:
    """Execute the monitor, diagnose, and plan stages as one pipeline."""
    snapshot = collect_monitor_snapshot(monitor_agent=monitor_agent)
    diagnosis = diagnose_snapshot(
        snapshot=snapshot,
        token_governor=token_governor,
        llm_api_url=llm_api_url,
        llm_model=llm_model,
    )
    plan = plan_diagnosis(diagnosis=diagnosis, context=plan_context)

    return {
        "status": "ok",
        "snapshot": snapshot,
        "diagnosis": diagnosis,
        "plan": plan,
        "completed_at": _utc_now(),
    }
