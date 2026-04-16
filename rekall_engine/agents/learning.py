"""
REKALL — ReportingAgent (formerly LearningAgent)

Handles the final reporting and notification of incident outcomes.
Per user request, this does NOT perform any RL learning or vault promotion.
It strictly handles:
  1. Slack Outcome Notification
  2. Notion Incident Logging
"""

from __future__ import annotations

import logging
from typing import Any

from .base import BaseAgent
from ..types import Outcome, FixProposal, DiagnosticBundle
from ..integrations import slack, notion

log = logging.getLogger("rekall.reporting")


class LearningAgent(BaseAgent):
    """
    ReportingAgent — handles the final outcome phase of the pipeline.
    Renamed internally to avoid graph rewiring, but logic is reporting-only.
    """
    name = "reporting"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input state keys:
          state["outcome"]        — Outcome
          state["fix_proposal"]   — FixProposal
          state["diagnostic_bundle"] — DiagnosticBundle
          state["governance_decision"] — GovernanceDecision
        """
        outcome: Outcome = state.get("outcome")
        fix: FixProposal = state.get("fix_proposal")
        bundle: DiagnosticBundle = state.get("diagnostic_bundle")
        gov = state.get("governance_decision")

        if not outcome or not fix:
            log.warning("[reporting] missing outcome or fix_proposal in state")
            return state

        log.info(
            "[reporting] incident=%s tier=%s result=%s",
            outcome.incident_id, fix.tier, outcome.result
        )

        # ── 1. Slack notification ───────────────────────────────────────────
        try:
            await slack.notify_outcome(
                incident_id=outcome.incident_id,
                source=bundle.metadata.get("source", "unknown") if bundle else "unknown",
                outcome=outcome.result,
                fix_tier=fix.tier,
                confidence=fix.confidence,
                reviewed_by=outcome.reviewed_by,
                notes=outcome.notes,
            )
        except Exception as exc:
            log.warning("[reporting] slack notify_outcome failed: %s", exc)

        # ── 2. Notion logging ───────────────────────────────────────────────
        try:
            await notion.log_incident(
                incident_id=outcome.incident_id,
                status=outcome.result,
                failure_type=bundle.failure_type if bundle else "unknown",
                source=bundle.metadata.get("source", "unknown") if bundle else "unknown",
                fix_tier=fix.tier,
                decision=gov.decision if gov else "N/A",
                confidence=fix.confidence,
                risk_score=gov.risk_score if gov else 0.0,
                fix_description=fix.fix_description,
                reviewed_by=outcome.reviewed_by,
                notes=outcome.notes,
            )
        except Exception as exc:
            log.warning("[reporting] notion log_incident failed: %s", exc)

        return state
