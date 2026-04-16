from datetime import datetime

from fastapi import APIRouter

from db import get_db

router = APIRouter()


@router.get("/healthz")
async def healthz():
    db_status = "connected"
    try:
        db = get_db()
        db.execute("SELECT 1")
        db.close()
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok",
        "version": "1.0.0",
        "db": db_status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
