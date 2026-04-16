from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from db import get_db

router = APIRouter(tags=["scenarios"])

SCENARIOS_FILE = Path(__file__).resolve().parents[1] / "data" / "scenarios.json"


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    db = get_db()
    try:
        rows = db.execute(
            "SELECT scenario_id, name, failure_class FROM scenarios ORDER BY scenario_id"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        db.close()


@router.post("/admin/load-scenarios")
def load_scenarios() -> dict:
    with SCENARIOS_FILE.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    scenarios = payload.get("scenarios", [])
    db = get_db()
    try:
        for scenario in scenarios:
            db.execute(
                """INSERT INTO scenarios (scenario_id, name, failure_class, scenario_json, loaded_at)
                   VALUES (?, ?, ?, ?, datetime('now'))
                   ON CONFLICT(scenario_id) DO UPDATE SET
                       name = excluded.name,
                       failure_class = excluded.failure_class,
                       scenario_json = excluded.scenario_json,
                       loaded_at = datetime('now')""",
                (
                    scenario["scenario_id"],
                    scenario["name"],
                    scenario["failure_class"],
                    json.dumps(scenario),
                ),
            )
        db.commit()
    finally:
        db.close()

    return {
        "loaded": len(scenarios),
        "scenarios": [scenario["scenario_id"] for scenario in scenarios],
    }
