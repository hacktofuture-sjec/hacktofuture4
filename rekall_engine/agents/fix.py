"""
REKALL — FixAgent

Tiered retrieval orchestrator: T1 → T2 → T3.

  T1 Human Knowledge Vault   confidence >= 0.85 → use directly (most trusted)
  T2 Synthetic Fix Cache      confidence >= 0.60 → validated AI fix
  T3 First Principles (RLM)  vault empty or all below threshold → REPL-based RLM

Uses the flat-file VaultStore for T1/T2 lookups and the RLMEngine
(Recursive Language Model with REPL sandbox) for T3 synthesis.

"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from .base import BaseAgent
from ..types import (
    DiagnosticBundle,
    FailureObject,
    FixProposal,
    FixSuggestion,
    FixDetail,
    VaultCandidate,
)
from .rlm_engine import RLMEngine
from ..vault.store import VaultStore
from ..config import engine_config

log = logging.getLogger("rekall.fix")

# T1/T2 confidence thresholds for vault matches
_T1_CONFIDENCE_THRESHOLD = 0.85
_T2_CONFIDENCE_THRESHOLD = 0.60


class FixAgent(BaseAgent):
    name = "fix"

    def __init__(self) -> None:
        self._rlm = RLMEngine()
        try:
            self._vault = VaultStore(vault_path=engine_config.vault_path)
        except Exception as exc:
            log.warning("[fix] vault init failed: %s — T1/T2 disabled", exc)
            self._vault = None

    # ── Main entry point ──────────────────────────────────────────────────────

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input state keys:
          state["diagnostic_bundle"] — DiagnosticBundle
          state["failure_object"]    — FailureObject  (optional, built from bundle)

        Output state keys:
          state["fix_suggestion"]  — FixSuggestion (Pydantic, with rlm_trace)
          state["fix_proposal"]    — FixProposal   (dataclass for Go backend)
        """
        bundle: DiagnosticBundle = state["diagnostic_bundle"]
        incident_id: str = bundle.incident_id

        # Build FailureObject for RLM (if not already in state)
        failure_obj: FailureObject = state.get("failure_object") or FailureObject(
            failure_id=incident_id,
            error_type=bundle.failure_type,
            error_message=bundle.failure_signature,
            full_log=bundle.log_excerpt,
        )

        # ── 1. Try T1/T2 vault lookup ────────────────────────────────────────
        vault_candidates = []

        if self._vault is not None:
            try:
                vault_candidates = self._query_vault(
                    bundle.failure_signature,
                    bundle.failure_type,
                    incident_id,
                )
            except Exception as exc:
                log.warning("[fix] vault query failed: %s — falling through to T3", exc)

        # ── 2. Tier 1 — exact signature match with high confidence ───────────
        t1_matches = [
            c for c in vault_candidates
            if c.get("source") == "human" and c.get("confidence", 0) >= _T1_CONFIDENCE_THRESHOLD
        ]
        if t1_matches:
            best = t1_matches[0]
            log.info("[fix] T1 hit — sig=%s confidence=%.2f", best.get("failure_signature"), best.get("confidence"))
            suggestion = self._build_vault_suggestion(
                incident_id, best, "T1_human",
            )
            state["fix_suggestion"] = suggestion
            state["fix_proposal"] = suggestion.to_fix_proposal(incident_id)
            return state

        # ── 3. Tier 2 — type match with moderate confidence ───────────────────
        t2_matches = [
            c for c in vault_candidates
            if c.get("confidence", 0) >= _T2_CONFIDENCE_THRESHOLD
        ]
        if t2_matches:
            best = t2_matches[0]
            log.info("[fix] T2 hit — sig=%s confidence=%.2f", best.get("failure_signature"), best.get("confidence"))
            suggestion = self._build_vault_suggestion(
                incident_id, best, "T2_synthetic",
            )
            state["fix_suggestion"] = suggestion
            state["fix_proposal"] = suggestion.to_fix_proposal(incident_id)
            return state

        # ── 4. Tier 3 — RLM (Recursive Language Model with REPL) ─────────────
        log.info(
            "[fix] no T1/T2 hit — escalating to T3 (RLM REPL). "
            "vault_candidates=%d",
            len(vault_candidates),
        )

        rlm_suggestion = await self._rlm.reason(failure_obj)

        state["fix_suggestion"] = rlm_suggestion
        state["fix_proposal"] = rlm_suggestion.to_fix_proposal(incident_id)

        return state

    # ── Vault query helpers ───────────────────────────────────────────────────

    def _query_vault(
        self,
        failure_signature: str,
        failure_type: str,
        incident_id: str,
    ) -> list:
        """
        Query flat-file vault for matching entries.
        Returns candidates.
        """
        candidates = []

        # T1: Exact signature match (local, then org)
        entry = self._vault.get_by_signature(failure_signature, scope="local")
        if entry:
            candidates.append(entry)

        if not entry and engine_config.org_vault_enabled:
            entry = self._vault.get_by_signature(failure_signature, scope="org")
            if entry:
                candidates.append(entry)

        # T2: Type-based search (broader)
        type_entries = self._vault.search_by_type(failure_type, scope="local")
        for e in type_entries:
            if e.get("failure_signature") != failure_signature:
                candidates.append(e)

        # Return the raw entries (sorted by confidence)
        accepted_entries = sorted(candidates, key=lambda e: e.get("confidence", 0), reverse=True)

        return accepted_entries



    def _build_vault_suggestion(
        self,
        incident_id: str,
        entry: dict,
        tier: str,
    ) -> FixSuggestion:
        """Build a FixSuggestion from a vault entry match."""
        fix_detail = FixDetail(
            fix_id=entry.get("id", str(uuid.uuid4())),
            source=entry.get("source", "human"),
            summary=entry.get("fix_description", ""),
            steps=entry.get("fix_commands", []),
            confidence=entry.get("confidence", 0.5),
            reasoning=f"Vault match ({tier}): signature '{entry.get('failure_signature')}'",
            matched_incident=entry.get("failure_signature"),
        )

        return FixSuggestion(
            failure_id=incident_id,
            suggested_fix=fix_detail,
            alternatives=[],
            context_used=0,
            rlm_trace=[],
        )
