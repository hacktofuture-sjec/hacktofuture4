"""
REKALL — MonitorAgent

Normalises raw CI/CD webhook payloads into a FailureEvent.
Extracts: source, failure_type, description, log_excerpt, commit info.
Handles GitHub Actions, GitLab CI, and the REKALL simulator format.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from .base import BaseAgent
from ..types import FailureEvent, FailureObject, AgentLogEntry

log = logging.getLogger("rekall.monitor")

# Keyword heuristics for failure_type classification
_TYPE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("security", ["secret", "leak", "credential", "token", "password", "api_key", "private_key"]),
    ("oom",      ["oom", "out of memory", "killed", "memory limit", "oomkilled"]),
    ("infra",    ["connection refused", "timeout", "postgres", "redis", "database", "dns",
                  "network", "socket", "unreachable", "cannot connect"]),
    ("deploy",   ["image pull", "backoff", "imagepullbackoff", "errimagepull", "container",
                  "docker", "helm", "kubectl", "deployment"]),
    ("test",     ["test", "failed", "assertion", "flak", "coverage", "jest", "pytest",
                  "rspec", "mocha", "cypress"]),
]


def _classify_failure(text: str) -> str:
    """Return failure_type based on keyword scan of combined text."""
    lowered = text.lower()
    for ftype, keywords in _TYPE_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return ftype
    return "unknown"


def _extract_log_excerpt(payload: dict[str, Any]) -> str:
    """Pull a log snippet from whichever field is present."""
    for key in ("log_excerpt", "error_log", "output", "message", "description"):
        val = payload.get(key)
        if val and isinstance(val, str) and len(val) > 10:
            return val[:8000]
    # Try nested structures (GitHub workflow_run)
    if isinstance(payload.get("workflow_run"), dict):
        name = payload["workflow_run"].get("name", "")
        conclusion = payload["workflow_run"].get("conclusion", "")
        return f"Workflow: {name}\nConclusion: {conclusion}"
    return ""


class MonitorAgent(BaseAgent):
    name = "monitor"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input:
          state["raw_webhook"]    — dict from Go backend (incident + payload merged)
          state["incident_id"]    — str UUID

        Output:
          state["failure_event"]  — FailureEvent dataclass
          state["failure_object"] — FailureObject Pydantic model (for RLM)
        """
        raw: dict[str, Any] = state.get("raw_webhook", {})
        incident_id: str = state.get("incident_id", str(uuid.uuid4()))

        # ── Determine source ────────────────────────────────────────────────
        source_raw = str(raw.get("source", "simulator")).lower()
        source_map = {
            "github":          "github_actions",
            "github_actions":  "github_actions",
            "gitlab":          "gitlab",
            "jenkins":         "jenkins",
            "simulator":       "simulator",
        }
        source = source_map.get(source_raw, "simulator")

        # ── Extract payload ─────────────────────────────────────────────────
        payload: dict[str, Any] = raw.get("payload", raw)

        # ── Classify failure type ───────────────────────────────────────────
        explicit_type = raw.get("failure_type") or payload.get("failure_type", "")
        valid_types = {"test", "deploy", "infra", "security", "oom", "unknown"}
        if explicit_type in valid_types:
            failure_type = explicit_type
        else:
            # Use heuristics on all text fields
            combined = " ".join(
                str(v)
                for v in (
                    payload.get("description", ""),
                    payload.get("log_excerpt", ""),
                    payload.get("error_log", ""),
                    payload.get("scenario", ""),
                )
            )
            failure_type = _classify_failure(combined) if combined.strip() else "unknown"

        # ── Build FailureEvent ──────────────────────────────────────────────
        event = FailureEvent(
            id=incident_id,
            source=source,
            failure_type=failure_type,
            raw_payload=payload,
            timestamp=datetime.utcnow(),
        )

        # ── Build FailureObject (for RLM engine) ────────────────────────────
        log_excerpt = _extract_log_excerpt(payload)
        failure_obj = FailureObject.from_failure_event(event, log=log_excerpt)

        log.info(
            "[monitor] incident=%s source=%s type=%s",
            incident_id, source, failure_type,
        )

        # Emit agent log
        state.setdefault("agent_logs", []).append(
            AgentLogEntry(
                incident_id=incident_id,
                step_name="monitor",
                status="done",
                detail=f"Detected {failure_type} failure from {source}",
            )
        )

        state["failure_event"]  = event
        state["failure_object"] = failure_obj
        return state
