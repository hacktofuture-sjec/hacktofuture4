"""
REKALL — GovernanceAgent

Continuous risk scoring (0.0–1.0) for every fix proposal.
Decision matrix:
  risk < 0.30  → auto_apply
  risk < 0.70  → create_pr
  risk >= 0.70 → block_await_human

Risk factors are additive weights. Each factor contributes a fixed delta
so the final score is deterministic and auditable.
"""

from __future__ import annotations

import logging
from typing import Any

from .base import BaseAgent
from ..types import FixProposal, DiagnosticBundle, GovernanceDecision, AgentLogEntry
from ..config import engine_config
from ..integrations import slack

log = logging.getLogger("rekall.governance")

# ── Risk factor weights ───────────────────────────────────────────────────────
_FACTORS: list[tuple[str, float, str]] = [
    # (factor_id, weight, description)
    ("llm_generated",         0.25, "Fix synthesised by LLM (no vault history)"),
    ("low_confidence",        0.20, "Confidence below 0.50"),
    ("no_vault_history",      0.15, "No matching vault entry found"),
    ("touches_secrets",       0.30, "Log contains secret/token/credential keywords"),
    ("production_branch",     0.20, "Branch is main, master, or production"),
    ("infra_failure",         0.15, "Infrastructure-class failure (higher blast radius)"),
    ("security_failure",      0.30, "Security-class failure"),
    ("negative_reward",       0.20, "Vault entry has negative reward score"),
    ("low_similarity",        0.10, "Similarity score below 0.80"),
]

_SECRET_KEYWORDS = frozenset([
    "secret", "token", "credential", "api_key", "private_key", "password",
    "auth", "bearer", "access_key", "secret_access",
])

_PROD_BRANCHES = frozenset(["main", "master", "production", "prod", "release"])


def _has_secret_keywords(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in _SECRET_KEYWORDS)


def _is_production_branch(bundle: DiagnosticBundle) -> bool:
    branch = bundle.metadata.get("branch", "") if hasattr(bundle, "metadata") else ""
    if not branch:
        # Try extracting from failure signature
        sig = bundle.failure_signature.lower()
        return any(b in sig for b in _PROD_BRANCHES)
    return branch.lower().split("/")[-1] in _PROD_BRANCHES


class GovernanceAgent(BaseAgent):
    name = "governance"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input:
          state["fix_proposal"]      — FixProposal
          state["diagnostic_bundle"] — DiagnosticBundle

        Output:
          state["governance_decision"] — GovernanceDecision
        """
        fix: FixProposal = state["fix_proposal"]
        bundle: DiagnosticBundle = state.get("diagnostic_bundle") or DiagnosticBundle(
            incident_id=fix.incident_id,
            failure_type="unknown",
            failure_signature="",
            log_excerpt="",
            git_diff=None,
            test_report=None,
            context_summary="",
        )

        risk_score, risk_factors = self._score(fix, bundle)
        risk_score = round(min(1.0, max(0.0, risk_score)), 4)

        if risk_score < engine_config.auto_apply_max_risk:
            decision = "auto_apply"
        elif risk_score < engine_config.create_pr_max_risk:
            decision = "create_pr"
        else:
            decision = "block_await_human"

        gov = GovernanceDecision(
            incident_id=fix.incident_id,
            risk_score=risk_score,
            decision=decision,
            risk_factors=risk_factors,
        )

        log.info(
            "[governance] incident=%s risk=%.2f decision=%s factors=%s",
            fix.incident_id, risk_score, decision, risk_factors,
        )

        state.setdefault("agent_logs", []).append(
            AgentLogEntry(
                incident_id=fix.incident_id,
                step_name="governance",
                status="done",
                detail=f"Risk {risk_score:.0%} → {decision.replace('_', ' ')}",
            )
        )

        state["governance_decision"] = gov
        
        # ── Integration: Slack Notification ───────────────────────────────────
        try:
            await slack.notify_governance(
                incident_id=gov.incident_id,
                failure_type=bundle.failure_type,
                source=bundle.metadata.get("source", "unknown"),
                risk_score=gov.risk_score,
                decision=gov.decision,
                risk_factors=gov.risk_factors,
                fix_description=fix.fix_description,
                fix_tier=fix.tier,
                confidence=fix.confidence,
            )
        except Exception as exc:
            log.warning("[governance] slack notify failed: %s", exc)

        return state

    # ── Scoring logic ─────────────────────────────────────────────────────────

    def _score(
        self,
        fix: FixProposal,
        bundle: DiagnosticBundle,
    ) -> tuple[float, list[str]]:
        risk    = 0.0
        factors: list[str] = []

        def add(factor_id: str, weight: float) -> None:
            nonlocal risk
            risk += weight
            factors.append(factor_id)

        # T3 LLM-generated
        if fix.tier == "T3_llm":
            add("llm_generated", 0.25)

        # Low confidence
        if fix.confidence < 0.50:
            add("low_confidence", 0.20)

        # No vault entry
        if fix.vault_entry_id is None:
            add("no_vault_history", 0.15)

        # Low similarity
        if fix.similarity_score is not None and fix.similarity_score < 0.80:
            add("low_similarity", 0.10)

        # Secret / credential keywords in log
        combined_text = " ".join([
            bundle.log_excerpt,
            bundle.failure_signature,
            fix.fix_description,
            " ".join(fix.fix_commands),
        ])
        if _has_secret_keywords(combined_text):
            add("touches_secrets", 0.30)

        # Production branch
        if _is_production_branch(bundle):
            add("production_branch", 0.20)

        # Security-class failure
        if bundle.failure_type == "security":
            add("security_failure", 0.30)
        elif bundle.failure_type == "infra":
            add("infra_failure", 0.15)

        return risk, factors
