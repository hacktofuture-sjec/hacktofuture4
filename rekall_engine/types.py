"""
REKALL Engine — Shared Data Types

Two sets of types live here:

  Section A  Dataclasses — used by the Go backend JSON contracts and the
             internal agent pipeline (FailureEvent, DiagnosticBundle, etc.)

  Section B  Pydantic models — the hackathon contracts aligned with the
             rlm-e-temp ML engineer layer (FailureObject, VaultQuery,
             VaultResponse, RewardSignal, FixSuggestion, etc.)
             These are the single source of truth for the AI agent layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION A — Internal dataclasses (Go backend ↔ Python engine contracts)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class FailureEvent:
    id: str
    source: Literal["github_actions", "gitlab", "jenkins", "simulator"]
    failure_type: Literal["test", "deploy", "infra", "security", "oom", "unknown"]
    raw_payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class DiagnosticBundle:
    incident_id: str
    failure_type: str
    failure_signature: str       # compact key used for vault lookup
    log_excerpt: str
    git_diff: Optional[str]
    test_report: Optional[str]
    context_summary: str         # LLM-compressed description for display
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VaultEntry:
    id: str
    failure_signature: str
    failure_type: str
    fix_description: str
    fix_commands: List[str]
    fix_diff: Optional[str]
    confidence: float            # 0.0 – 1.0, updated per outcome
    retrieval_count: int
    success_count: int
    source: Literal["human", "synthetic"]
    created_at: datetime
    embedding: List[float] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FixProposal:
    incident_id: str
    tier: Literal["T1_human", "T2_synthetic", "T3_llm"]
    vault_entry_id: Optional[str]
    similarity_score: Optional[float]
    fix_description: str
    fix_commands: List[str]
    fix_diff: Optional[str]
    confidence: float
    reasoning: str = ""


@dataclass
class GovernanceDecision:
    incident_id: str
    risk_score: float            # 0.0 – 1.0
    decision: Literal["auto_apply", "create_pr", "block_await_human"]
    risk_factors: List[str]


@dataclass
class Outcome:
    incident_id: str
    fix_proposal_id: str
    result: Literal["success", "failure", "rejected"]
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class AgentLogEntry:
    incident_id: str
    step_name: str
    status: Literal["running", "done", "error"]
    detail: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION B — Pydantic contracts (AI agent layer ↔ memory layer)
#             Aligned with rlm-e-temp/contracts/types.py
# ═══════════════════════════════════════════════════════════════════════════════

class FailureObject(BaseModel):
    """CI/CD failure event after validation and noise-stripping."""
    failure_id: str = Field(..., description="Unique ID — matches incident_id in Go backend")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    repo: str = ""
    workflow_name: str = ""
    stage: str = ""
    error_type: str = Field(..., description="Normalised by validator: test|deploy|infra|security|oom|unknown")
    error_message: str = ""
    full_log: str = Field(..., description="Noise-stripped log context (up to 120k chars)")
    commit_sha: str = ""
    branch: str = ""
    triggered_by: str = ""
    validation_passed: bool = True

    @classmethod
    def from_failure_event(cls, event: FailureEvent, log: str = "") -> "FailureObject":
        """Convert internal FailureEvent to FailureObject for the AI agent layer."""
        payload = event.raw_payload
        return cls(
            failure_id=event.id,
            timestamp=event.timestamp,
            repo=str(payload.get("repository", {}).get("full_name", "")),
            workflow_name=str(payload.get("workflow_run", {}).get("name", "") if isinstance(payload.get("workflow_run"), dict) else ""),
            stage=event.failure_type,
            error_type=event.failure_type,
            error_message=str(payload.get("description", payload.get("log_excerpt", "")[:200])),
            full_log=log or str(payload.get("log_excerpt", "")),
            commit_sha=str(payload.get("commit_sha", "")),
            branch=str(payload.get("branch", "")),
            triggered_by=str(payload.get("triggered_by", event.source)),
        )


class VaultQuery(BaseModel):
    """Query issued by FixAgent to the Memory layer."""
    query_id: str
    failure_id: str
    search_program: str = "vector_semantic"
    failure_signature: str
    top_k: int = 5


class VaultCandidate(BaseModel):
    """A single vault entry returned by the Memory layer."""
    fix_id: str
    source: Literal["human", "synthetic"]
    fix_summary: str
    fix_steps: List[str]
    matched_on: str
    last_applied: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    success_rate: float = 0.5


class VaultResponse(BaseModel):
    """Memory layer response to a VaultQuery."""
    query_id: str
    candidates: List[VaultCandidate]
    vault_empty: bool


class FixDetail(BaseModel):
    """A single fix proposal (from vault or first-principles synthesis)."""
    fix_id: str
    source: Literal["human", "synthetic", "first_principles", "llm"]
    summary: str
    steps: List[str]
    confidence: float
    reasoning: str
    matched_incident: Optional[str] = None


class FixSuggestion(BaseModel):
    """Full response from the AI agent — sent to UI and stored in DB."""
    failure_id: str
    suggested_fix: FixDetail
    alternatives: List[FixDetail] = Field(default_factory=list)
    context_used: int = Field(0, description="Chars of log reasoned over by RLM")
    rlm_trace: List[Dict[str, Any]] = Field(default_factory=list, description="Depth 0/1 reasoning trace")

    def to_fix_proposal(self, incident_id: str) -> FixProposal:
        """Convert to the dataclass used by the Go backend."""
        tier_map = {
            "human": "T1_human",
            "synthetic": "T2_synthetic",
            "first_principles": "T3_llm",
            "llm": "T3_llm",
        }
        fix = self.suggested_fix
        return FixProposal(
            incident_id=incident_id,
            tier=tier_map.get(fix.source, "T3_llm"),
            vault_entry_id=fix.matched_incident,
            similarity_score=None,
            fix_description=fix.summary,
            fix_commands=fix.steps,
            fix_diff=None,
            confidence=fix.confidence,
            reasoning=fix.reasoning,
        )
