from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import settings
from db import get_db

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=None)
def healthz() -> dict:
    db_status = "disconnected"
    db = None
    try:
        db = get_db()
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

    payload = {
        "status": "ok" if db_status == "connected" else "degraded",
        "version": settings.app_version,
        "db": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if db_status != "connected":
        return JSONResponse(status_code=503, content=payload)

    return payload
