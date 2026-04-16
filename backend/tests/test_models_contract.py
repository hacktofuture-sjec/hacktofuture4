import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.enums import FailureClass, IncidentStatus, RiskLevel, Severity
from models.schemas import (
    DiagnosisPayload,
    IncidentEvent,
    IncidentSnapshot,
    IncidentScope,
    LogSignature,
    MetricSummary,
    PlannerAction,
    PlannerOutput,
    SimulationResult,
    StructuredReasoning,
)


def test_incident_snapshot_contract_minimal():
    snapshot = IncidentSnapshot(
        incident_id="inc-101",
        alert="High memory usage",
        service="payment-api",
        pod="payment-api-6f5d",
        metrics=MetricSummary(cpu="85%", memory="95%", restarts=3, latency_delta="2.1x"),
        events=[],
        logs_summary=[LogSignature(signature="OOMKilled", count=4)],
        scope=IncidentScope(namespace="default", deployment="payment-api"),
        monitor_confidence=0.92,
        failure_class=FailureClass.RESOURCE_EXHAUSTION,
        dependency_graph_summary="frontend -> payment-api -> db",
    )

    assert snapshot.failure_class == FailureClass.RESOURCE_EXHAUSTION
    assert snapshot.metrics.memory == "95%"


def test_diagnosis_payload_contract():
    payload = DiagnosisPayload(
        root_cause="memory exhaustion",
        confidence=0.9,
        diagnosis_mode="rule",
        fingerprint_matched=True,
        affected_services=["payment-api"],
        evidence=["OOMKilled event", "memory > 90%"],
        structured_reasoning=StructuredReasoning(
            matched_rules=["FP-001"],
            conflicting_signals=[],
            missing_signals=[],
        ),
    )

    assert payload.diagnosis_mode == "rule"
    assert payload.fingerprint_matched is True


def test_planner_output_contract():
    action = PlannerAction(
        action="kubectl rollout restart deployment/payment-api -n default",
        description="Restart to clear bad state",
        risk_level=RiskLevel.MEDIUM,
        expected_outcome="Memory drops",
        confidence=0.82,
        approval_required=True,
        simulation_result=SimulationResult(
            blast_radius_score=0.3,
            rollback_ready=True,
            dependency_impact="limited",
            policy_violations=[],
        ),
    )

    output = PlannerOutput(actions=[action])
    assert len(output.actions) == 1
    assert output.actions[0].risk_level == RiskLevel.MEDIUM


def test_incident_event_contract():
    event = IncidentEvent(
        incident_id="inc-101",
        status=IncidentStatus.OPEN,
        severity=Severity.HIGH,
        created_at="2026-04-16T10:11:12Z",
    )

    assert event.status == IncidentStatus.OPEN
    assert event.severity == Severity.HIGH
