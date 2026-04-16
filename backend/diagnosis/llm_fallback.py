from __future__ import annotations

import json

from config import settings
from governance.token_governor import get_incident_ai_spend, get_run_ai_spend
from models.schemas import DiagnosisPayload, IncidentSnapshot, StructuredReasoning


def build_diagnosis_prompt(snapshot: IncidentSnapshot, features: dict) -> str:
    return (
        "You are diagnosing a Kubernetes incident. Respond with strict JSON containing "
        "root_cause, confidence, affected_services, evidence, structured_reasoning.\n"
        f"Snapshot: {snapshot.model_dump_json()}\n"
        f"Features: {json.dumps(features)}"
    )


def parse_diagnosis_response(raw: str, estimated_cost: float, actual_cost: float) -> DiagnosisPayload | None:
    try:
        start = raw.index("{")
        end = raw.rindex("}") + 1
        payload = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return None

    required = ["root_cause", "confidence", "affected_services", "evidence", "structured_reasoning"]
    if not all(key in payload for key in required):
        return None

    reasoning = payload.get("structured_reasoning", {})
    return DiagnosisPayload(
        root_cause=payload["root_cause"],
        confidence=float(payload["confidence"]),
        diagnosis_mode="ai",
        fingerprint_matched=False,
        estimated_token_cost=estimated_cost,
        actual_token_cost=actual_cost,
        affected_services=list(payload["affected_services"]),
        evidence=list(payload["evidence"]),
        structured_reasoning=StructuredReasoning(
            matched_rules=reasoning.get("matched_rules", []),
            conflicting_signals=reasoning.get("conflicting_signals", []),
            missing_signals=reasoning.get("missing_signals", []),
        ),
    )


def rule_only_fallback(snapshot: IncidentSnapshot, features: dict) -> DiagnosisPayload:
    evidence = [
        f"memory={snapshot.metrics.memory}",
        f"cpu={snapshot.metrics.cpu}",
        f"restarts={snapshot.metrics.restarts}",
    ]
    if snapshot.events:
        evidence.append(f"event={snapshot.events[0].reason}")

    return DiagnosisPayload(
        root_cause="insufficient high-confidence fingerprint; rule fallback applied",
        confidence=max(0.5, min(0.74, float(snapshot.monitor_confidence))),
        diagnosis_mode="rule",
        fingerprint_matched=False,
        estimated_token_cost=0.0,
        actual_token_cost=0.0,
        affected_services=[snapshot.service],
        evidence=evidence,
        structured_reasoning=StructuredReasoning(
            matched_rules=[],
            conflicting_signals=[],
            missing_signals=[] if snapshot.trace_summary else ["trace_summary not triggered"],
        ),
    )


def run_ai_diagnosis(snapshot: IncidentSnapshot, features: dict, token_governor, db, incident_id: str) -> DiagnosisPayload:
    prompt = build_diagnosis_prompt(snapshot, features)
    estimate = token_governor.estimate(prompt)

    decision = token_governor.check_budget(
        estimated_cost=estimate["estimated_cost_usd"],
        incident_accumulated=get_incident_ai_spend(db, incident_id),
        run_accumulated=get_run_ai_spend(db),
    )
    if not decision.allowed:
        token_governor.record_usage(
            db,
            incident_id,
            "diagnose",
            estimate["tokens"],
            0,
            estimate["estimated_cost_usd"],
            0.0,
            True,
            decision.reason,
        )
        return rule_only_fallback(snapshot, features)

    # Offline-safe deterministic AI fallback: if no API key, synthesize structured response.
    if not settings.openai_api_key:
        response = DiagnosisPayload(
            root_cause="probable dependency or configuration issue based on mixed telemetry",
            confidence=0.72,
            diagnosis_mode="ai",
            fingerprint_matched=False,
            estimated_token_cost=estimate["estimated_cost_usd"],
            actual_token_cost=0.0,
            affected_services=[snapshot.service],
            evidence=[
                f"latency_delta={snapshot.metrics.latency_delta}",
                f"log_signatures={len(snapshot.logs_summary)}",
            ],
            structured_reasoning=StructuredReasoning(
                matched_rules=[],
                conflicting_signals=[],
                missing_signals=[] if snapshot.trace_summary else ["trace_summary not triggered"],
            ),
        )
        token_governor.record_usage(
            db,
            incident_id,
            "diagnose",
            estimate["tokens"],
            0,
            estimate["estimated_cost_usd"],
            0.0,
            True,
            "policy_block",
        )
        return response

    # If API integration is added later, replace this block with real model call + parse.
    return rule_only_fallback(snapshot, features)
