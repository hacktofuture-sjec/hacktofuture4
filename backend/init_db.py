from db import db_cursor


def init_db() -> None:
    with db_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                incident_id TEXT PRIMARY KEY,
                service TEXT NOT NULL,
                status TEXT NOT NULL,
                failure_class TEXT,
                summary TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS scenarios (
                scenario_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                failure_class TEXT NOT NULL,
                scenario_json TEXT NOT NULL,
                loaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS incident_plans (
                plan_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                actions TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS executions (
                execution_id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                command TEXT NOT NULL,
                result TEXT NOT NULL,
                status TEXT NOT NULL,
                executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        cur.connection.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
