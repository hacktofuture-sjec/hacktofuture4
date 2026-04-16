from models.enums import IncidentStatus


ALLOWED_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.OPEN: {IncidentStatus.DIAGNOSING, IncidentStatus.FAILED},
    IncidentStatus.DIAGNOSING: {IncidentStatus.PLANNED, IncidentStatus.FAILED},
    IncidentStatus.PLANNED: {IncidentStatus.PENDING_APPROVAL, IncidentStatus.EXECUTING, IncidentStatus.FAILED},
    IncidentStatus.PENDING_APPROVAL: {IncidentStatus.EXECUTING, IncidentStatus.FAILED},
    IncidentStatus.EXECUTING: {IncidentStatus.VERIFYING, IncidentStatus.FAILED},
    IncidentStatus.VERIFYING: {IncidentStatus.RESOLVED, IncidentStatus.FAILED},
    IncidentStatus.RESOLVED: set(),
    IncidentStatus.FAILED: set(),
}


def can_transition(current: IncidentStatus, target: IncidentStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def assert_transition(current: IncidentStatus, target: IncidentStatus) -> None:
    if not can_transition(current, target):
        raise ValueError(f"Invalid incident transition: {current.value} -> {target.value}")
