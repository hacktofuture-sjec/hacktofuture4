from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from db import get_db_dep

router = APIRouter()


@router.get("/cost-report")
def cost_report(
    incident_id: str | None = Query(None),
    db: sqlite3.Connection = Depends(get_db_dep),
):
    where = "WHERE incident_id=?" if incident_id else ""
    params = [incident_id] if incident_id else []

    rows = db.execute(
        f"""SELECT incident_id, stage, model_name, input_tokens, output_tokens,
                   estimated_cost_usd, actual_cost_usd, fallback_triggered, reason, timestamp
            FROM token_usage {where} ORDER BY timestamp ASC""",
        params,
    ).fetchall()

    stages = [dict(row) for row in rows]
    total_input = sum(row["input_tokens"] for row in rows)
    total_output = sum(row["output_tokens"] for row in rows)
    total_cost = sum(row["actual_cost_usd"] for row in rows)
    calls = len(rows)
    fallback_triggered = any(bool(row["fallback_triggered"]) for row in rows)

    return {
        "incident_id": incident_id,
        "stages": stages,
        "summary": {
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_ai_calls": calls,
            "total_actual_cost_usd": round(total_cost, 6),
            "rule_only_resolution": calls == 0,
            "fallback_triggered": fallback_triggered,
        },
    }
