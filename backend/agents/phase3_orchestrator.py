from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from agents.monitor_agent import MonitorAgent
from diagnosis.feature_extractor import extract_features
from diagnosis.llm_fallback import call_llm_api, should_use_llm_fallback
from diagnosis.rule_engine import match_fingerprint
from governance.token_governor import TokenGovernor
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
    }


def _build_evidence(snapshot: dict[str, Any], fingerprint: Optional[dict[str, Any]]) -> list[str]:
    evidence: list[str] = []

    for event in snapshot.get("events", [])[:3]:
        if isinstance(event, dict):
            reason = str(event.get("reason", "")).strip()
            message = str(event.get("message", "")).strip()
            if reason:
                evidence.append(f"event:{reason}")
            if message:
                evidence.append(f"event_msg:{message[:140]}")
        elif str(event).strip():
            evidence.append(f"event:{str(event).strip()[:140]}")

    for log in snapshot.get("logs_summary", [])[:3]:
        if isinstance(log, dict):
            signature = str(log.get("signature", "")).strip()
            count = int(log.get("count", 0) or 0)
            if signature:
                evidence.append(f"log:{signature[:140]} (x{count})")
        elif str(log).strip():
            evidence.append(f"log:{str(log).strip()[:140]}")

    trace = snapshot.get("trace") or {}
    if isinstance(trace, dict):
        hot_span = str(trace.get("hot_span", "")).strip()
        if hot_span:
            evidence.append(f"trace_hot_span:{hot_span[:140]}")

    if fingerprint:
        evidence.append(f"fingerprint:{fingerprint.get('fingerprint_id')}")

    # Preserve insertion order while dropping duplicates.
    seen = set()
    deduped: list[str] = []
    for item in evidence:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped[:8]


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
    normalized = _coerce_snapshot(snapshot)

    fingerprint = match_fingerprint(normalized)
    features = extract_features(normalized)

    rule_confidence = float(fingerprint.get("confidence", 0.0)) if fingerprint else 0.0
    use_llm = should_use_llm_fallback(
        rule_confidence=rule_confidence,
        budget_allows=True,
        confidence_threshold=tg.budget.rule_confidence_threshold,
        token_governor=tg,
    )

    llm_result: Optional[dict[str, Any]] = None
    if use_llm:
        llm_result = call_llm_api(
            incident_snapshot=normalized,
            model=llm_model,
            api_url=llm_api_url,
        )
        if llm_result is not None:
            estimated_input = tg.estimate_tokens(json.dumps(normalized, default=str))
            estimated_output = tg.estimate_tokens(json.dumps(llm_result, default=str))
            estimated_cost = tg.estimate_cost(estimated_input, estimated_output)
            tg.record_ai_call(
                estimated_tokens=estimated_input,
                actual_tokens=estimated_input + estimated_output,
                estimated_cost=estimated_cost,
                actual_cost=estimated_cost,
            )

    if llm_result is not None:
        evidence = _build_evidence(normalized, fingerprint)
        return {
            "source": "llm_fallback",
            "root_cause": llm_result.get("root_cause", "unknown"),
            "confidence": float(llm_result.get("confidence", 0.0)),
            "reasoning": llm_result.get("reasoning", "AI-based diagnosis"),
            "suggested_actions": llm_result.get("suggested_actions", []),
            "fingerprint_id": fingerprint.get("fingerprint_id") if fingerprint else None,
            "recommended_fix": fingerprint.get("recommended_fix") if fingerprint else None,
            "evidence": evidence,
            "features": features,
            "diagnosed_at": _utc_now(),
        }

    if fingerprint is not None:
        root_cause = str(fingerprint.get("name", "unknown")).replace("_", " ")
        evidence = _build_evidence(normalized, fingerprint)
        return {
            "source": "rule",
            "root_cause": root_cause,
            "confidence": float(fingerprint.get("confidence", 0.0)),
            "reasoning": f"Matched fingerprint {fingerprint['fingerprint_id']}",
            "suggested_actions": [fingerprint.get("recommended_fix", "investigate service")],
            "fingerprint_id": fingerprint["fingerprint_id"],
            "recommended_fix": fingerprint.get("recommended_fix"),
            "evidence": evidence,
            "features": features,
            "diagnosed_at": _utc_now(),
        }

    return {
        "source": "rule",
        "root_cause": "unknown",
        "confidence": 0.0,
        "reasoning": "No fingerprint matched and LLM fallback unavailable",
        "suggested_actions": ["collect more telemetry and inspect pod logs"],
        "fingerprint_id": None,
        "recommended_fix": None,
        "evidence": _build_evidence(normalized, None),
        "features": features,
        "diagnosed_at": _utc_now(),
    }


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
        payload = action.model_dump()
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
