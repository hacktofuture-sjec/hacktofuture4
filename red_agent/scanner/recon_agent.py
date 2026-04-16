"""Stub for the autonomous CrewAI recon agent.

Provides the interface expected by red_service so the backend can start.
Real implementation will wire up CrewAI tasks later.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

_sessions: dict[str, dict] = {}


@dataclass
class ReconResult:
    session_id: str
    target: str
    status: str = "pending"
    risk_score: float = 0.0
    attack_vectors: list[dict[str, Any]] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    started_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    finished_at: str | None = None


async def run_recon_session(target: str, context: str | None = None) -> str:
    """Start a recon session and return its id."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "session_id": session_id,
        "target": target,
        "status": "running",
        "result": ReconResult(session_id=session_id, target=target, status="running"),
    }
    return session_id


def get_session_result(session_id: str) -> ReconResult | None:
    entry = _sessions.get(session_id)
    return entry["result"] if entry else None


def has_session(session_id: str) -> bool:
    return session_id in _sessions


def list_sessions() -> list[dict]:
    return [
        {"session_id": sid, "target": s["target"], "status": s["status"]}
        for sid, s in _sessions.items()
    ]
