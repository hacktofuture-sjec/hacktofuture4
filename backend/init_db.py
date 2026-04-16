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


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
