"""
Seed 5 human-approved vault entries so the demo has Tier-1 hits from the start.
Run once: python -m backend.db.seed_vault
"""

import asyncio
import json
import os
import uuid
from datetime import datetime

import asyncpg

SEED_ENTRIES = [
    {
        "chroma_id": "seed-postgres-refused",
        "source": "human",
        "failure_type": "infra",
        "fix_description": "PostgreSQL ECONNREFUSED: restore correct host in database.yml and restart app",
        "confidence": 0.92,
    },
    {
        "chroma_id": "seed-oom-heap",
        "source": "human",
        "failure_type": "oom",
        "fix_description": "OOM kill: increase JVM heap via -Xmx flag or raise container memory limit",
        "confidence": 0.87,
    },
    {
        "chroma_id": "seed-test-auth-401",
        "source": "human",
        "failure_type": "test",
        "fix_description": "Auth test failure 401: middleware regression — revert token check to verify(token) guard",
        "confidence": 0.85,
    },
    {
        "chroma_id": "seed-secret-leak",
        "source": "human",
        "failure_type": "security",
        "fix_description": "Secret detected in .env: rotate key immediately, add .env to .gitignore, purge from history",
        "confidence": 0.95,
    },
    {
        "chroma_id": "seed-image-pull",
        "source": "human",
        "failure_type": "deploy",
        "fix_description": "ImagePullBackOff: image tag not found — build and push the missing tag or roll back IMAGE_TAG",
        "confidence": 0.89,
    },
]


async def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set")

    conn = await asyncpg.connect(url)
    try:
        for entry in SEED_ENTRIES:
            await conn.execute(
                """
                INSERT INTO vault_entries
                  (id, chroma_id, source, failure_type, fix_description, confidence)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (chroma_id) DO NOTHING
                """,
                str(uuid.uuid4()),
                entry["chroma_id"],
                entry["source"],
                entry["failure_type"],
                entry["fix_description"],
                entry["confidence"],
            )
        print(f"Seeded {len(SEED_ENTRIES)} vault entries.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
