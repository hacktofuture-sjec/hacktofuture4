from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from models.enums import (
    DependencyImpact,
    DiagnosisMode,
    ExecutorStatus,
    FailureClass,
    IncidentStatus,
    RiskLevel,
    Severity,
)


class MetricSummary(BaseModel):
    cpu: str
    memory: str
    restarts: int
    latency_delta: str


class EventRecord(BaseModel):
    reason: str
    message: str = ""
    count: int = 1
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    pod: str = ""
    namespace: str = ""
    type: str = "Warning"


class LogSignature(BaseModel):
    signature: str
    count: int


class TraceSummary(BaseModel):
    enabled: bool = True
    suspected_path: str
    hot_span: str
    p95_ms: int


class IncidentScope(BaseModel):
    namespace: str
    deployment: str


class IncidentSnapshot(BaseModel):
    incident_id: str
    alert: str
    service: str
    pod: str
    metrics: MetricSummary
    events: list[EventRecord]
    logs_summary: list[LogSignature]
    trace_summary: Optional[TraceSummary] = None
    scope: IncidentScope
    monitor_confidence: float = Field(ge=0.0, le=1.0)
    failure_class: FailureClass
    dependency_graph_summary: str


class StructuredReasoning(BaseModel):
    matched_rules: list[str]
    conflicting_signals: list[str]
    missing_signals: list[str]


class DiagnosisPayload(BaseModel):
    root_cause: str
    confidence: float = Field(ge=0.0, le=1.0)
    diagnosis_mode: DiagnosisMode
    fingerprint_matched: bool
    estimated_token_cost: float = 0.0
    actual_token_cost: float = 0.0
    affected_services: list[str]
    evidence: list[str]
    structured_reasoning: StructuredReasoning


class SimulationResult(BaseModel):
    blast_radius_score: float = Field(ge=0.0, le=1.0)
    rollback_ready: bool
    dependency_impact: DependencyImpact
    policy_violations: list[str] = []


class PlannerAction(BaseModel):
    action: str
    description: str
    risk_level: RiskLevel
    expected_outcome: str
    confidence: float = Field(ge=0.0, le=1.0)
    approval_required: bool
    estimated_token_cost: float = 0.0
    actual_token_cost: float = 0.0
    simulation_result: SimulationResult


class PlannerOutput(BaseModel):
    actions: list[PlannerAction]


class ThresholdCheck(BaseModel):
    metric: str
    threshold: float
    observed: float
    passed: bool


class VerificationOutput(BaseModel):
    verification_window_seconds: int
    thresholds_checked: list[ThresholdCheck]
    recovered: bool
    close_reason: str


class ExecutorResult(BaseModel):
    action: str
    status: ExecutorStatus
    sandbox_validated: bool
    rollback_needed: bool
    execution_timestamp: Optional[str] = None
    error: Optional[str] = None


class TokenUsageRecord(BaseModel):
    incident_id: str
    stage: str
    model_name: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    actual_cost_usd: float
    fallback_triggered: bool
    reason: Optional[str] = None
    timestamp: str


class TokenSummary(BaseModel):
    total_input_tokens: int
    total_output_tokens: int
    total_ai_calls: int
    total_actual_cost_usd: float
    rule_only_resolution: bool
    fallback_triggered: bool


class IncidentEvent(BaseModel):
    incident_id: str
    status: IncidentStatus
    scenario_id: Optional[str] = None
    severity: Severity
    created_at: str


class IncidentListItem(BaseModel):
    incident_id: str
    status: IncidentStatus
    service: str
    failure_class: FailureClass
    severity: Severity
    monitor_confidence: float
    created_at: str
    updated_at: str


class IncidentDetail(BaseModel):
    incident_id: str
    status: IncidentStatus
    scenario_id: Optional[str]
    service: str
    namespace: str
    pod: str
    failure_class: FailureClass
    severity: Severity
    monitor_confidence: float
    snapshot: IncidentSnapshot
    diagnosis: Optional[DiagnosisPayload] = None
    plan: Optional[PlannerOutput] = None
    execution: Optional[ExecutorResult] = None
    verification: Optional[VerificationOutput] = None
    token_summary: Optional[TokenSummary] = None
    created_at: str
    resolved_at: Optional[str] = None


class TimelineEvent(BaseModel):
    timestamp: str
    status: IncidentStatus
    actor: str
    note: str


class IncidentTimeline(BaseModel):
    incident_id: str
    events: list[TimelineEvent]


class ApprovalRequest(BaseModel):
    action_index: int
    approved: bool
    operator_id: str = "operator"
    operator_note: str = ""


class ApprovalResponse(BaseModel):
    incident_id: str
    action_index: Optional[int]
    approved: bool
    status: IncidentStatus
    message: str


class FaultInjectionRequest(BaseModel):
    scenario_id: str
    force: bool = False


class FaultInjectionResponse(BaseModel):
    scenario_id: str
    snapshot: IncidentSnapshot
    message: str
