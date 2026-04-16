from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .enums import (
    DependencyImpact,
    DiagnosisMode,
    ExecutorStatus,
    FailureClass,
    IncidentStatus,
    Outcome,
    RiskLevel,
    Severity,
)

INCIDENT_ID_PATTERN = re.compile(r"^inc-[0-9a-f]{8}$")


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

    @field_validator("incident_id")
    @classmethod
    def validate_incident_id(cls, value: str) -> str:
        if not INCIDENT_ID_PATTERN.match(value):
            raise ValueError("incident_id must match inc-{8 hex chars}")
        return value


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

    @field_validator("action")
    @classmethod
    def validate_action_prefix(cls, value: str) -> str:
        if not value.startswith("kubectl"):
            raise ValueError("action must start with 'kubectl'")
        return value


class PlannerOutput(BaseModel):
    actions: list[PlannerAction]


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


class ExecutorResult(BaseModel):
    action: str
    status: ExecutorStatus
    sandbox_validated: bool
    rollback_needed: bool
    execution_timestamp: Optional[str] = None
    error: Optional[str] = None


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


class CostReport(BaseModel):
    incident_id: Optional[str]
    stages: list[TokenUsageRecord]
    summary: TokenSummary


class IncidentMemoryRecord(BaseModel):
    incident_fingerprint: str
    symptoms: list[str]
    failure_class: FailureClass
    root_cause: str
    selected_fix: str
    outcome: Outcome
    success_rate: float = Field(ge=0.0, le=1.0)
    median_recovery_seconds: int


class FaultInjectionRequest(BaseModel):
    scenario_id: str


class FaultInjectionResponse(BaseModel):
    incident_id: str
    scenario_id: str
    status: IncidentStatus
    message: str


class ScenarioListItem(BaseModel):
    scenario_id: str
    name: str
    failure_class: FailureClass


class IncidentFromAlertRequest(BaseModel):
    alert: str
    service: str
    namespace: str
    deployment: str
    pod: Optional[str] = None
    severity: Severity = Severity.MEDIUM
    scenario_id: Optional[str] = None


class IncidentEvent(BaseModel):
    incident_id: str
    status: IncidentStatus
    scenario_id: Optional[str] = None
    severity: Severity
    created_at: str

    @field_validator("incident_id")
    @classmethod
    def validate_incident_event_id(cls, value: str) -> str:
        if not INCIDENT_ID_PATTERN.match(value):
            raise ValueError("incident_id must match inc-{8 hex chars}")
        return value


class IncidentListItem(BaseModel):
    incident_id: str
    status: IncidentStatus
    service: str
    failure_class: FailureClass
    severity: Severity
    monitor_confidence: float
    created_at: str
    updated_at: str


class TimelineEvent(BaseModel):
    timestamp: str
    status: IncidentStatus
    actor: str
    note: str


class IncidentTimeline(BaseModel):
    incident_id: str
    events: list[TimelineEvent]


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


class WSStatusChange(BaseModel):
    type: str = "status_change"
    incident_id: str
    previous_status: IncidentStatus
    new_status: IncidentStatus
    timestamp: str


class WSDiagnosisComplete(BaseModel):
    type: str = "diagnosis_complete"
    incident_id: str
    diagnosis: DiagnosisPayload


class WSPlanReady(BaseModel):
    type: str = "plan_ready"
    incident_id: str
    plan: PlannerOutput


class WSExecutionUpdate(BaseModel):
    type: str = "execution_update"
    incident_id: str
    execution: ExecutorResult


class WSIncidentResolved(BaseModel):
    type: str = "incident_resolved"
    incident_id: str
    verification: VerificationOutput
    token_summary: TokenSummary
