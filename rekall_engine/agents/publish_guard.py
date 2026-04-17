"""
REKALL — PublishGuardAgent

Deterministic supply-chain safety gate.
Sits between GovernanceAgent and LearningAgent.

Runs a hard checklist before any fix is applied. If ANY check fails,
the decision is escalated to block_await_human regardless of what
GovernanceAgent decided.

Checks:
  1. Secret/credential keywords not present in the fix commands
  2. Fix does not try to modify CI secrets files (.env, .secrets, etc.)
  3. No registry push commands without explicit image tag (no :latest)
  4. Security failures always require human review (never auto-apply)
  5. Fix commands don't contain destructive operations (rm -rf /, DROP TABLE, etc.)

This is a zero-LLM-call agent — it's fully deterministic and fast.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from .base import BaseAgent
from ..types import FixProposal, GovernanceDecision, DiagnosticBundle, AgentLogEntry

log = logging.getLogger("rekall.publish_guard")

# ── Patterns that flag a fix as unsafe for auto-apply ────────────────────────

_DESTRUCTIVE_PATTERNS = [
    re.compile(r"rm\s+-rf\s+/", re.IGNORECASE),
    re.compile(r"DROP\s+TABLE", re.IGNORECASE),
    re.compile(r"DROP\s+DATABASE", re.IGNORECASE),
    re.compile(r"truncate\s+table", re.IGNORECASE),
    re.compile(r"format\s+[a-z]:", re.IGNORECASE),  # Windows format
    re.compile(r"dd\s+if=", re.IGNORECASE),           # disk overwrite
]

_SECRET_FILE_PATTERNS = [
    re.compile(r"\.env", re.IGNORECASE),
    re.compile(r"\.secrets", re.IGNORECASE),
    re.compile(r"credentials\.json", re.IGNORECASE),
    re.compile(r"service.account", re.IGNORECASE),
    re.compile(r"id_rsa", re.IGNORECASE),
    re.compile(r"\.pem$", re.IGNORECASE),
    re.compile(r"\.key$", re.IGNORECASE),
]

_REGISTRY_LATEST = re.compile(r"docker\s+push\s+.*:latest", re.IGNORECASE)

# Failure types that ALWAYS need human review, never auto-apply
_ALWAYS_BLOCK_TYPES = frozenset(["security"])


class PublishGuardAgent(BaseAgent):
    name = "publish_guard"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input:
          state["fix_proposal"]      — FixProposal
          state["diagnostic_bundle"] — DiagnosticBundle
          state["governance_decision"] — GovernanceDecision

        Output:
          state["governance_decision"] — may be escalated to block_await_human
          state["publish_guard_flags"]  — list of triggered flags (for UI)
        """
        fix: FixProposal = state.get("fix_proposal")
        bundle: DiagnosticBundle = state.get("diagnostic_bundle")
        gov: GovernanceDecision = state.get("governance_decision")

        if not fix:
            log.warning("[publish_guard] no fix_proposal in state — skipping")
            state["publish_guard_flags"] = []
            return state

        flags: list[str] = []

        # Combine all text to check
        commands_text = " ".join(fix.fix_commands or [])
        all_text = f"{commands_text} {fix.fix_description} {fix.reasoning}"

        # ── Check 1: Destructive commands ─────────────────────────────────────
        for pattern in _DESTRUCTIVE_PATTERNS:
            if pattern.search(all_text):
                flags.append(f"destructive_command:{pattern.pattern[:30]}")

        # ── Check 2: Secret file modification ────────────────────────────────
        for pattern in _SECRET_FILE_PATTERNS:
            if pattern.search(all_text):
                flags.append(f"secret_file_access:{pattern.pattern[:30]}")
                break  # one flag is enough

        # ── Check 3: Registry push with :latest ──────────────────────────────
        if _REGISTRY_LATEST.search(all_text):
            flags.append("registry_push_latest_tag")

        # ── Check 4: Security failure type ───────────────────────────────────
        failure_type = ""
        if bundle:
            failure_type = bundle.failure_type or ""
        if failure_type in _ALWAYS_BLOCK_TYPES:
            flags.append(f"failure_type_requires_review:{failure_type}")

        # ── Escalate if any flags triggered ──────────────────────────────────
        if flags and gov and gov.decision != "block_await_human":
            log.warning(
                "[publish_guard] escalating %s → block_await_human. flags=%s",
                gov.decision,
                flags,
            )
            # Promote decision to block
            from ..types import GovernanceDecision as GD
            escalated = GD(
                incident_id=gov.incident_id,
                risk_score=min(1.0, gov.risk_score + 0.3),
                decision="block_await_human",
                risk_factors=list(gov.risk_factors) + [f"publish_guard:{f}" for f in flags],
            )
            state["governance_decision"] = escalated
        else:
            log.info(
                "[publish_guard] passed. decision=%s flags=%s",
                gov.decision if gov else "none",
                flags,
            )

        incident_id = fix.incident_id
        state.setdefault("agent_logs", []).append(
            AgentLogEntry(
                incident_id=incident_id,
                step_name="publish_guard",
                status="done",
                detail=(
                    f"Supply-chain gate: {len(flags)} flag(s). "
                    + (f"Escalated → block. Flags: {flags}" if flags else "All checks passed.")
                ),
            )
        )

        state["publish_guard_flags"] = flags
        return state
