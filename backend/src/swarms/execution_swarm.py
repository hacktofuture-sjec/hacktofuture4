from __future__ import annotations

from src.gates.permission_gate import PermissionGate, PermissionRequest


class ExecutionSwarm:
    def __init__(self, permission_gate: PermissionGate) -> None:
        self.permission_gate = permission_gate

    def run(self, trace_id: str, action: str) -> dict:
        decision = self.permission_gate.evaluate(PermissionRequest(trace_id=trace_id, action=action))
        if decision["requires_human_approval"]:
            return {
                "action": action,
                "status": "pending_approval",
                "requires_human_approval": True,
                "risk_level": decision["risk_level"],
                "reason": decision["reason"],
            }

        return {
            "action": action,
            "status": "mock_executed",
            "requires_human_approval": False,
            "risk_level": decision["risk_level"],
            "reason": decision["reason"],
        }
