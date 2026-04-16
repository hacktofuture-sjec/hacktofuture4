import json
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from db import get_db_dep

router = APIRouter()
SCENARIOS_FILE = Path(__file__).resolve().parents[1] / "data" / "scenarios.json"


@router.get("/scenarios")
def list_scenarios(db: sqlite3.Connection = Depends(get_db_dep)):
    rows = db.execute(
        "SELECT scenario_id, name, failure_class FROM scenarios ORDER BY scenario_id"
    ).fetchall()
    return [dict(row) for row in rows]


@router.post("/admin/load-scenarios")
def load_scenarios(db: sqlite3.Connection = Depends(get_db_dep)):
    if not SCENARIOS_FILE.exists():
        raise HTTPException(status_code=404, detail="data/scenarios.json not found")

    with SCENARIOS_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    ids: list[str] = []
    for scenario in data.get("scenarios", []):
        existing = db.execute(
            "SELECT 1 FROM scenarios WHERE scenario_id=?", (scenario["scenario_id"],)
        ).fetchone()
        if not existing:
            db.execute(
                "INSERT INTO scenarios (scenario_id, name, failure_class, scenario_json, loaded_at) "
                "VALUES (?, ?, ?, ?, datetime('now'))",
                (
                    scenario["scenario_id"],
                    scenario["name"],
                    scenario["failure_class"],
                    json.dumps(scenario),
                ),
            )
            count += 1
        ids.append(scenario["scenario_id"])

    db.commit()
    return {"loaded": count, "scenarios": ids}
