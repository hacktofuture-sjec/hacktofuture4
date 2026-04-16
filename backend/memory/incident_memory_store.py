from __future__ import annotations

import json
from datetime import datetime


class IncidentMemoryStore:
    def __init__(self, db):
        self.db = db

    def write(self, incident_id: str, snapshot, diagnosis, selected_fix: str, outcome: str, recovery_seconds: int) -> None:
        fingerprint = f"{snapshot.failure_class.value}:{snapshot.service}"
        symptoms = [event.reason for event in snapshot.events[:5]]
        self.db.execute(
            """INSERT INTO incident_memory
               (incident_fingerprint, symptoms_json, failure_class, root_cause,
                selected_fix, outcome, recovery_seconds, incident_id, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                fingerprint,
                json.dumps(symptoms),
                snapshot.failure_class.value,
                diagnosis.root_cause,
                selected_fix,
                outcome,
                recovery_seconds,
                incident_id,
                datetime.utcnow().isoformat() + "Z",
            ),
        )
        self.db.commit()

    def get_ranked_fixes(self, failure_class: str) -> list[dict]:
        rows = self.db.execute(
            """SELECT selected_fix,
                      AVG(CASE WHEN outcome='success' THEN 1.0 ELSE 0.0 END) as success_rate,
                      AVG(recovery_seconds) as median_recovery_seconds,
                      COUNT(*) as sample_count
               FROM incident_memory
               WHERE failure_class=?
               GROUP BY selected_fix
               ORDER BY success_rate DESC, median_recovery_seconds ASC
               LIMIT 20""",
            (failure_class,),
        ).fetchall()
        return [
            {
                "selected_fix": row["selected_fix"],
                "success_rate": round(float(row["success_rate"] or 0.0), 2),
                "median_recovery_seconds": int(row["median_recovery_seconds"] or 0),
                "sample_count": int(row["sample_count"] or 0),
            }
            for row in rows
        ]
