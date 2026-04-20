from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class PermissionRequest:
    trace_id: str
    action: str


@dataclass
class PermissionDecision:
    trace_id: str
    action: str
    requires_human_approval: bool
    risk_level: str
    reason: str


class PermissionGate:
    SAFE_ACTION_KEYWORDS = {
        "summarize",
        "explain",
        "diagnostic",
        "read-only",
        "collect",
    }

    HIGH_RISK_KEYWORDS = {
        "rollback",
        "deploy",
        "delete",
        "scale",
        "create",
        "post",
        "update",
        "execute",
    }

    def evaluate(self, request: PermissionRequest) -> dict:
        normalized = request.action.lower()

        if any(word in normalized for word in self.HIGH_RISK_KEYWORDS):
            decision = PermissionDecision(
                trace_id=request.trace_id,
                action=request.action,
                requires_human_approval=True,
                risk_level="high",
                reason="Action modifies external systems and requires explicit approval.",
            )
            return asdict(decision)

        if any(word in normalized for word in self.SAFE_ACTION_KEYWORDS):
            decision = PermissionDecision(
                trace_id=request.trace_id,
                action=request.action,
                requires_human_approval=False,
                risk_level="low",
                reason="Action is read-only or summarization oriented.",
            )
            return asdict(decision)

        decision = PermissionDecision(
            trace_id=request.trace_id,
            action=request.action,
            requires_human_approval=True,
            risk_level="medium",
            reason="Action classification uncertain; defaulting to safe HITL approval.",
        )
        return asdict(decision)
