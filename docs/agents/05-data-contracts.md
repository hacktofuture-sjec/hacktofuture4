# Data Contracts: Pydantic Models & Enums

## Purpose

All data flowing through the T3PS2 pipeline is validated against Pydantic models. This document defines every model and enum used across diagnosis, planner, execution, and telemetry layers.

---

## Files

- **Enums**: `backend/models/enums.py` (~80 lines)
- **Models**: `backend/models/schemas.py` (~200 lines)
- **Tests**: `backend/tests/test_models_contract.py` (4 tests)

---

## Enums

### IncidentStatus (7 states)

```python
class IncidentStatus(str, Enum):
    """Incident lifecycle state."""
    DETECTED = "detected"          # Anomaly detected by monitor
    ACKNOWLEDGED = "acknowledged"  # Human acknowledged
    DIAGNOSED = "diagnosed"        # Root cause identified
    PLANNED = "planned"            # Remediation actions ranked
    APPROVED = "approved"          # Human approved actions
    EXECUTING = "executing"        # Actions being applied
    RESOLVED = "resolved"          # Incident closed
    ESCALATED = "escalated"        # Requires manual intervention
```

### FailureClass (6 types)

```python
class FailureClass(str, Enum):
    """Failure category."""
    RESOURCE = "resource"          # CPU/memory/disk exhaustion
    CONFIG = "config"              # Configuration error
    CODE = "code"                  # Application bug
    DEPENDENCY = "dependency"      # External service failure
    NETWORK = "network"            # Network/connectivity issue
    UNKNOWN = "unknown"            # Unclassified
```

### RiskLevel (3 levels)

```python
class RiskLevel(str, Enum):
    """Risk classification for remediation actions."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
```

### DiagnosisMode (2 modes)

```python
class DiagnosisMode(str, Enum):
    """How diagnosis was performed."""
    RULE_BASED = "rule_based"
    LLM_FALLBACK = "llm_fallback"
```

### Outcome (3 outcomes)

```python
class Outcome(str, Enum):
    """Remediation outcome."""
    SUCCESS = "success"
    PARTIAL = "partial"  # Partially mitigated
    FAILED = "failed"
```

### DependencyImpact (3 impacts)

```python
class DependencyImpact(str, Enum):
    """Impact on dependent services."""
    ISOLATED = "isolated"      # No impact on downstream
    DEGRADED = "degraded"      # Partial impact
    CASCADED = "cascaded"      # Full cascade to dependents
```

### Severity (3 levels)

```python
class Severity(str, Enum):
    """Incident severity."""
    LOW = "low"
    MEDIUM = "medium"
    CRITICAL = "critical"
```

### ExecutorStatus (5 statuses)

```python
class ExecutorStatus(str, Enum):
    """Executor progress state."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
```

---

## Core Models

### IncidentSnapshot

**Input to Diagnosis Agent**

```python
@dataclass
class IncidentSnapshot:
    """Incident observation snapshot from Monitor Agent."""
    incident_id: str
    service: str
    namespace: str = "default"
    timestamp: str  # ISO 8601

    # Metrics
    metrics: Dict[str, Any]  # {cpu_pct, memory_pct, restart_count, latency_delta}

    # Events
    events: List[Dict[str, str]]  # {reason, message, timestamp}

    # Logs
    logs_summary: List[Dict[str, Any]]  # {signature, count, severity}

    # Context
    context: Dict[str, Any] = None  # {image_tag, replicas, namespace, ...}
```

### DiagnosisPayload

**Output from Diagnosis Agent**

```python
@dataclass
class DiagnosisPayload:
    """Complete diagnosis with explanation and confidence."""
    incident_id: str
    diagnosis_mode: DiagnosisMode  # rule_based or llm_fallback

    # Primary result
    root_cause: str
    confidence: float  # 0.0 to 1.0
    failure_class: FailureClass

    # Evidence
    reasoning: str
    evidence: List[str]  # Feature values or LLM reasoning steps

    # Impact
    affected_services: List[str]
    severity: Severity
    dependency_impact: DependencyImpact

    # Audit
    fingerprint_id: Optional[str] = None  # If rule-based
    llm_model: Optional[str] = None  # If LLM fallback

    timestamp: str = None
```

### RankedAction

**Single action in planner output**

```python
@dataclass
class RankedAction:
    """Single ranked remediation action."""
    command: str  # Actual kubectl/API command
    description: str
    risk_level: RiskLevel
    policy_id: str
    confidence: float  # Inherited from diagnosis
    estimated_duration_seconds: int = 30
```

### PlannerOutput

**Output from Planner Agent**

```python
@dataclass
class PlannerOutput:
    """Ranked remediation actions for human approval."""
    incident_id: str
    root_cause: str
    confidence: float

    ranked_actions: List[RankedAction]  # Sorted by risk (low first)

    num_actions_approved: int = 0
    timestamp: str = None
```

### ExecutorResult

**Output from Executor Agent**

```python
@dataclass
class ExecutorResult:
    """Remediation execution result."""
    incident_id: str

    status: ExecutorStatus
    action_applied: str  # Which command was executed

    outcome: Outcome
    duration_seconds: float

    # Result details
    logs: str  # kubectl/API output
    error_message: Optional[str] = None

    timestamp: str = None
```

### VerificationOutput

**Output from Verification/Learning Layer**

```python
@dataclass
class VerificationOutput:
    """Post-remediation verification and learning."""
    incident_id: str

    # Recovery metrics
    metrics_normalized: bool  # Did metrics return to baseline?
    service_healthy: bool  # Is service responding?
    dependency_impact_resolved: bool

    # Learning
    root_cause_confirmed: bool
    suggested_prevention: str

    timestamp: str = None
```

### TokenUsageRecord

**AI token tracking**

```python
@dataclass
class TokenUsageRecord:
    """AI token and cost tracking for incident."""
    incident_id: str

    # Estimated (for budgeting)
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_cost_usd: float

    # Actual (for billing)
    actual_input_tokens: Optional[int] = None
    actual_output_tokens: Optional[int] = None
    actual_cost_usd: Optional[float] = None

    model: str = "gpt-3.5-turbo"
    timestamp: str = None
```

---

## Feature Vector (Diagnosis)

```python
@dataclass
class FeatureVector:
    """13 features extracted from incident snapshot."""
    # Metrics (4)
    cpu_pct_now: float
    memory_pct_now: float
    restart_count: int
    latency_multiplier: float

    # Signals (5)
    cpu_z_score: float
    memory_z_score: float
    latency_z_score: float
    burst_restarts_flag: int  # 0 or 1
    burst_latency_flag: int  # 0 or 1

    # Logs/Events (4)
    top_error_signature: str
    top_event_reason: str
    error_signature_count: int
    event_frequency_score: float
```

---

## Validation Examples

### Valid IncidentSnapshot

```python
snapshot = IncidentSnapshot(
    incident_id="inc-001",
    service="payments-api",
    namespace="prod",
    timestamp="2024-04-16T10:23:15Z",
    metrics={
        "cpu_pct": 45,
        "memory_pct": 95,
        "restart_count": 2,
        "latency_delta": "1.1x",
    },
    events=[
        {"reason": "OOMKilled", "message": "Out of memory", "timestamp": "2024-04-16T10:23:15Z"},
    ],
    logs_summary=[
        {"signature": "memory exhaustion", "count": 5, "severity": "critical"},
    ],
    context={"namespace": "prod", "replicas": 3},
)

# Valid! All required fields present.
```

### Valid DiagnosisPayload

```python
diagnosis = DiagnosisPayload(
    incident_id="inc-001",
    diagnosis_mode=DiagnosisMode.RULE_BASED,
    root_cause="memory exhaustion: container exceeded memory limit",
    confidence=0.95,
    failure_class=FailureClass.RESOURCE,
    reasoning="OOMKilled event + 95% memory usage indicates kernel OOM killer triggered",
    evidence=["OOMKilled event present", "memory_pct_now=95", "restart_count=2"],
    affected_services=["payments-api"],
    severity=Severity.CRITICAL,
    dependency_impact=DependencyImpact.CASCADED,
    fingerprint_id="FP-001",
    timestamp="2024-04-16T10:23:20Z",
)

# Valid! Diagnosis properly categorized with evidence.
```

### Valid PlannerOutput

```python
planner = PlannerOutput(
    incident_id="inc-001",
    root_cause="memory exhaustion: container exceeded memory limit",
    confidence=0.95,
    ranked_actions=[
        RankedAction(
            command="kubectl rollout restart deployment/payments-api -n prod",
            description="Restart pod to clear memory state",
            risk_level=RiskLevel.LOW,
            policy_id="POL-001",
            confidence=0.95,
            estimated_duration_seconds=30,
        ),
        RankedAction(
            command="kubectl patch deployment/payments-api -n prod -p '{...}'",
            description="Increase memory limit",
            risk_level=RiskLevel.MEDIUM,
            policy_id="POL-002",
            confidence=0.95,
            estimated_duration_seconds=60,
        ),
    ],
    timestamp="2024-04-16T10:23:25Z",
)

# Valid! Actions sorted by risk, inheritance of confidence.
```

---

## JSON Serialization

All models are JSON-serializable via Pydantic:

```python
import json
from backend.models.schemas import DiagnosisPayload

diagnosis = DiagnosisPayload(...)
json_str = json.dumps(diagnosis, default=pydantic_encoder)

# Deserialize
diagnosis_restored = json.loads(json_str)
```

---

## Test Coverage

| Test                             | Validates                                     |
| -------------------------------- | --------------------------------------------- |
| `test_incident_snapshot_valid`   | IncidentSnapshot model creation + validation  |
| `test_diagnosis_payload_valid`   | DiagnosisPayload model creation + validation  |
| `test_planner_output_valid`      | PlannerOutput model creation + validation     |
| `test_models_json_serialization` | All models serialize/deserialize to/from JSON |

---

## Usage Guidelines

### When Defining New Models

1. Use `@dataclass` decorator for simplicity
2. Type-hint all fields with specific types (not `Any`)
3. Mark optional fields with `Optional[T] = None`
4. Use enums for categorical fields (not string literals)
5. Include docstring with purpose and usage context
6. Add timestamp field for audit trail

### When Processing Data

```python
# ✅ GOOD: Type-safe validation
try:
    diagnosis = DiagnosisPayload(**raw_data)  # Pydantic validates
except ValidationError as e:
    logger.error(f"Invalid diagnosis data: {e}")
    raise

# ❌ BAD: Unvalidated dynamic access
root_cause = raw_data.get("root_cause")  # No type checking
confidence = raw_data["confidence"]  # May not exist
```

---

## Related Documentation

- [01-phase1-diagnosis.md](01-phase1-diagnosis.md) — FeatureVector usage
- [02-phase2-llm-fallback.md](02-phase2-llm-fallback.md) — DiagnosisPayload from LLM
- [03-phase2-planner.md](03-phase2-planner.md) — RankedAction and PlannerOutput
- [07-api-endpoints.md](07-api-endpoints.md) — API request/response models
