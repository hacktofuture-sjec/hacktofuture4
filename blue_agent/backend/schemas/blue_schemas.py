"""Request / response models for the Blue Agent backend."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ToolStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class ToolCall(BaseModel):
    id: str
    name: str = Field(..., description="Tool name, e.g. close_port, verify_fix")
    category: str = Field(..., description="defend | patch | strategy")
    status: ToolStatus = ToolStatus.PENDING
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: datetime | None = None


class LogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    level: str = "INFO"
    message: str
    tool_id: str | None = None


class ClosePortRequest(BaseModel):
    host: str
    port: int
    protocol: str = "tcp"


class HardenServiceRequest(BaseModel):
    host: str
    service: str
    options: dict[str, Any] = Field(default_factory=dict)


class IsolateHostRequest(BaseModel):
    host: str
    reason: str | None = None


class DefenseResult(BaseModel):
    tool_call: ToolCall
    success: bool = True
    detail: str | None = None


class PatchRequest(BaseModel):
    host: str
    cve_id: str | None = None
    package: str | None = None


class PatchResult(BaseModel):
    tool_call: ToolCall
    applied: bool = False
    notes: str | None = None


class VerifyFixRequest(BaseModel):
    host: str
    cve_id: str


class VerifyFixResult(BaseModel):
    tool_call: ToolCall
    verified: bool = False
    evidence: str | None = None


class StrategyRequest(BaseModel):
    host: str
    threat: dict[str, Any] = Field(default_factory=dict)


class DefensePlan(BaseModel):
    tool_call: ToolCall
    steps: list[str] = Field(default_factory=list)
    rationale: str | None = None
