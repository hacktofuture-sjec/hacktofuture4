from datetime import datetime, timezone

from fastapi import APIRouter

from config import settings
from db import get_db

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict:
    db_status = "disconnected"
    try:
        db = get_db()
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    finally:
        try:
            db.close()
        except Exception:
            pass

    return {
        "status": "ok",
        "version": settings.app_version,
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
