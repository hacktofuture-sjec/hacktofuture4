#!/usr/bin/env python3
"""Initialize the T3PS2 SQLite database."""

import os
import sqlite3

from config import settings


TABLES = [
    """
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'open',
        scenario_id TEXT,
        service TEXT NOT NULL,
        namespace TEXT NOT NULL,
        pod TEXT NOT NULL,
        failure_class TEXT NOT NULL,
        severity TEXT NOT NULL,
        monitor_confidence REAL NOT NULL,
        snapshot_json TEXT NOT NULL,
        diagnosis_json TEXT,
        plan_json TEXT,
        execution_json TEXT,
        verification_json TEXT,
        approved_action_index INTEGER,
        approved_by TEXT,
        approval_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        diagnosed_at TEXT,
        planned_at TEXT,
        approved_at TEXT,
        executed_at TEXT,
        verified_at TEXT,
        resolved_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS incident_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        actor TEXT NOT NULL,
        note TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        model_name TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        estimated_cost_usd REAL NOT NULL,
        actual_cost_usd REAL NOT NULL,
        fallback_triggered INTEGER NOT NULL,
        reason TEXT,
        timestamp TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS incident_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_fingerprint TEXT NOT NULL,
        symptoms_json TEXT NOT NULL,
        failure_class TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        selected_fix TEXT NOT NULL,
        outcome TEXT NOT NULL,
        recovery_seconds INTEGER NOT NULL,
        incident_id TEXT NOT NULL,
        recorded_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS scenarios (
        scenario_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        failure_class TEXT NOT NULL,
        scenario_json TEXT NOT NULL,
        loaded_at TEXT NOT NULL
    )
    """,
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)",
    "CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service)",
    "CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_timeline_incident ON incident_timeline(incident_id)",
    "CREATE INDEX IF NOT EXISTS idx_token_usage_incident ON token_usage(incident_id)",
    "CREATE INDEX IF NOT EXISTS idx_memory_fingerprint ON incident_memory(incident_fingerprint)",
    "CREATE INDEX IF NOT EXISTS idx_memory_failure_class ON incident_memory(failure_class)",
]


def main() -> None:
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)

    conn = sqlite3.connect(settings.db_path)
    for ddl in TABLES:
        conn.execute(ddl)
    for index_stmt in INDEXES:
        conn.execute(index_stmt)
    conn.commit()
    conn.close()

    print(f"Database initialized: {settings.db_path}")
    print("Tables created: incidents, incident_timeline, token_usage, incident_memory, scenarios")


if __name__ == "__main__":
    main()
