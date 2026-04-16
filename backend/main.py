"""
main.py — FastAPI application entry point
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from io import BytesIO
from typing import List

from fastapi import BackgroundTasks, FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal, get_db, init_db
from .models import Problem, ProblemDetail, ProblemOut
from .news_fetcher import fetch_articles
from .ai_processor import process_articles
from .zip_builder import build_zip

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ── Global processing state (in-memory) ────────────────────────────────────────
_state = {
    "is_running": False,
    "logs": [],
    "progress": 0,
    "total": 0,
    "completed": 0,
    "started_at": None,
}


def _log(message: str, level: str = "info"):
    _state["logs"].append({"msg": message, "level": level, "ts": time.time()})
    if len(_state["logs"]) > 80:
        _state["logs"] = _state["logs"][-80:]
    logger.info("[pipeline] %s", message)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialised.")
    yield


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Startup Problem Marketplace API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Background pipeline ────────────────────────────────────────────────────────

async def _run_pipeline():
    _state["is_running"] = True
    _state["logs"] = []
    _state["progress"] = 0
    _state["total"] = 0
    _state["completed"] = 0
    _state["started_at"] = time.time()

    db = SessionLocal()
    try:
        _log("Fetching latest news from RSS feeds...")
        articles = await asyncio.to_thread(fetch_articles)
        _log(f"Fetched {len(articles)} raw articles")

        if not articles:
            _log("No articles fetched — check your network connection.", "warning")
            return

        await process_articles(articles, db, _log, _state)
        _log(
            f"Done! Generated {_state['completed']} packages out of {_state['total']} relevant articles.",
            "success",
        )
    except Exception as exc:
        _log(f"Pipeline error: {exc}", "error")
        logger.exception("Pipeline crashed")
    finally:
        db.close()
        _state["is_running"] = False


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "model": settings.OLLAMA_MODEL}


@app.post("/api/news/fetch")
async def trigger_fetch(background_tasks: BackgroundTasks):
    if _state["is_running"]:
        raise HTTPException(409, "Processing is already running. Wait for it to finish.")
    background_tasks.add_task(_run_pipeline)
    return {"status": "started", "message": "Pipeline running in background"}


@app.get("/api/news/status")
def get_status():
    return {
        "is_running": _state["is_running"],
        "progress": _state["progress"],
        "total": _state["total"],
        "completed": _state["completed"],
        "logs": _state["logs"][-30:],  # last 30 log lines
    }


@app.get("/api/problems", response_model=List[ProblemOut])
def list_problems(db: Session = Depends(get_db)):
    return (
        db.query(Problem)
        .filter(Problem.is_published == True)  # noqa: E712
        .order_by(Problem.created_at.desc())
        .all()
    )


@app.get("/api/problems/{problem_id}", response_model=ProblemDetail)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    return p


@app.get("/api/problems/{problem_id}/download")
def download_problem(problem_id: int, db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    zip_bytes = build_zip(p)
    p.download_count += 1
    db.commit()
    return StreamingResponse(
        BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{p.slug}.zip"'},
    )


@app.delete("/api/problems/{problem_id}")
def delete_problem(problem_id: int, db: Session = Depends(get_db)):
    p = db.query(Problem).filter(Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    db.delete(p)
    db.commit()
    return {"status": "deleted"}
