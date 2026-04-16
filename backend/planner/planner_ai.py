from __future__ import annotations

from config import settings
from governance.token_governor import get_incident_ai_spend, get_run_ai_spend


def run_ai_planner(diagnosis, snapshot, token_governor, db) -> list[dict] | None:
    prompt = (
        "Generate a safe Kubernetes remediation plan in strict JSON array format. "
        f"Diagnosis: {diagnosis.model_dump_json()} Snapshot: {snapshot.model_dump_json()}"
    )

    estimate = token_governor.estimate(prompt)
    decision = token_governor.check_budget(
        estimated_cost=estimate["estimated_cost_usd"],
        incident_accumulated=get_incident_ai_spend(db, snapshot.incident_id),
        run_accumulated=get_run_ai_spend(db),
    )

    if not decision.allowed:
        token_governor.record_usage(
            db,
            snapshot.incident_id,
            "planner",
            estimate["tokens"],
            0,
            estimate["estimated_cost_usd"],
            0.0,
            True,
            decision.reason,
        )
        return None

    # Offline-safe fallback path for hackathon environment.
    if not settings.openai_api_key:
        token_governor.record_usage(
            db,
            snapshot.incident_id,
            "planner",
            estimate["tokens"],
            0,
            estimate["estimated_cost_usd"],
            0.0,
            True,
            "policy_block",
        )
        return None

    # Real API integration can be added here.
    return None
