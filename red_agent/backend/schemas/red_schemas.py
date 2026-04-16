"""Request / response models for the Red Agent backend."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ToolStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class ToolCall(BaseModel):
    """Represents a single tool invocation surfaced in the UI."""

    id: str
    name: str = Field(..., description="Tool name, e.g. nmap_scan, lookup_cve")
    category: str = Field(..., description="scan | exploit | strategy")
    status: ToolStatus = ToolStatus.PENDING
    params: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None


class LogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    level: str = "INFO"
    message: str
    tool_id: Optional[str] = None


class ScanRequest(BaseModel):
    target: str = Field(..., examples=["192.168.1.100"])
    ports: Optional[List[int]] = None
    options: Dict[str, Any] = Field(default_factory=dict)


class ScanResult(BaseModel):
    tool_call: ToolCall
    open_ports: List[int] = Field(default_factory=list)
    services: Dict[int, str] = Field(default_factory=dict)
    findings: List[str] = Field(default_factory=list)


class CVELookupRequest(BaseModel):
    service: str
    version: Optional[str] = None


class CVELookupResult(BaseModel):
    tool_call: ToolCall
    cve_ids: List[str] = Field(default_factory=list)
    summaries: Dict[str, str] = Field(default_factory=dict)


class ExploitRequest(BaseModel):
    target: str
    cve_id: Optional[str] = None
    payload: Optional[str] = None
    options: Dict[str, Any] = Field(default_factory=dict)


class ExploitResult(BaseModel):
    tool_call: ToolCall
    success: bool = False
    foothold: Optional[str] = None
    notes: Optional[str] = None


class StrategyRequest(BaseModel):
    target: str
    intel: Dict[str, Any] = Field(default_factory=dict)


class StrategyPlan(BaseModel):
    tool_call: ToolCall
    steps: List[str] = Field(default_factory=list)
    rationale: Optional[str] = None
