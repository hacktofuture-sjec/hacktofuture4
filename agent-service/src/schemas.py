"""
Pydantic v2 schemas for the FastAPI agent service.

TicketState       — LangGraph state (TypedDict)
UnifiedTicketSchema — target mapping schema (output of Mapper node)
RawEventRequest    — pipeline trigger payload
ProcessingResult   — final pipeline result
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypedDict

# ── LangGraph State ───────────────────────────────────────────────────────────


class TicketState(TypedDict):
    """State passed between all LangGraph nodes in the pipeline."""

    raw_payload: Dict[str, Any]
    source: str  # provider name: jira, slack, linear, hubspot
    organization_id: str
    integration_id: int
    event_id: int
    attempt_count: int
    mapped_data: Optional[Dict[str, Any]]
    validation_errors: List[str]
    is_valid: bool
    processing_run_id: Optional[str]


# ── Unified Ticket Schema (Mapper Target) ─────────────────────────────────────


class UnifiedTicketSchema(BaseModel):
    """
    Strict output schema for the LLM Mapper node.
    LLM must produce JSON that validates against this model.
    """

    external_ticket_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=1000)
    description: str = Field(default="")
    normalized_status: str = Field(...)
    normalized_type: str = Field(default="task")
    priority: str = Field(default="none")
    assignee_external_id: Optional[str] = None
    reporter_external_id: Optional[str] = None
    due_date: Optional[str] = None  # ISO-8601 date string
    labels: List[str] = Field(default_factory=list)
    provider_metadata: Dict[str, Any] = Field(default_factory=dict)
    source_created_at: Optional[str] = None  # ISO-8601 datetime
    source_updated_at: Optional[str] = None  # ISO-8601 datetime

    @field_validator("normalized_status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"open", "in_progress", "blocked", "resolved"}
        if v not in allowed:
            raise ValueError(f"normalized_status must be one of {allowed}, got '{v}'")
        return v

    @field_validator("normalized_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {"bug", "feature", "task", "epic", "story", "subtask", "other"}
        if v not in allowed:
            return "other"
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"critical", "high", "medium", "low", "none"}
        if v not in allowed:
            return "none"
        return v


# ── API Request / Response Schemas ────────────────────────────────────────────


class PipelineRunRequest(BaseModel):
    """POST /pipeline/run — trigger the LangGraph pipeline."""

    event_id: int
    source: str
    raw_payload: Dict[str, Any]
    organization_id: str
    integration_id: int


class ProcessingResult(BaseModel):
    """Response from /pipeline/run."""

    event_id: int
    processing_run_id: Optional[str]
    success: bool
    attempt_count: int
    sent_to_dlq: bool = False
    ticket_id: Optional[int] = None
    validation_errors: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class SyncRequest(BaseModel):
    """POST /pipeline/sync — trigger incremental provider sync."""

    integration_account_id: int
    provider: str
    config: Dict[str, Any]
    credentials: Dict[str, Any]
    checkpoint: Dict[str, Any]
    organization_id: str


class SyncResult(BaseModel):
    next_checkpoint: Dict[str, Any]
    records_processed: int


class ActionRequest(BaseModel):
    """POST /pipeline/action — Trigger autonomous action via text input."""

    text: str
    organization_id: str
    user_id: Optional[str] = None


class ActionItemData(BaseModel):
    tool: str
    action: str
    details: Dict[str, Any]
    status: str
    message: str


class ActionResult(BaseModel):
    """Response from /pipeline/action."""

    original_text: str
    actions_taken: List[ActionItemData]
    success: bool
    message: str
