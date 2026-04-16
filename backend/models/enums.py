from enum import Enum


class IncidentStatus(str, Enum):
    OPEN = "open"
    DIAGNOSING = "diagnosing"
    PLANNED = "planned"
    PENDING_APPROVAL = "pending_approval"
    EXECUTING = "executing"
    VERIFYING = "verifying"
    RESOLVED = "resolved"
    FAILED = "failed"


class FailureClass(str, Enum):
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    APPLICATION_CRASH = "application_crash"
    CONFIG_ERROR = "config_error"
    INFRA_SATURATION = "infra_saturation"
    DEPENDENCY_FAILURE = "dependency_failure"
    UNKNOWN = "unknown"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DiagnosisMode(str, Enum):
    RULE = "rule"
    AI = "ai"


class Outcome(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class DependencyImpact(str, Enum):
    NONE = "none"
    LIMITED = "limited"
    BROAD = "broad"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ExecutorStatus(str, Enum):
    SUCCESS = "success"
    SANDBOX_FAILED = "sandbox_failed"
    PRODUCTION_FAILED = "production_failed"
    FAILED = "failed"
