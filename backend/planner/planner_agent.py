from __future__ import annotations

from typing import Any, Optional

from models.enums import RiskLevel
from models.schemas import PlannerAction, PlannerOutput
from planner.plan_simulator import simulate_action
from planner.policy_ranker import lookup_policy


class PlannerAgent:
    """Convert diagnosis output into ranked planner actions with simulation data."""

    def run(
        self,
        diagnosis: dict[str, Any],
        snapshot: dict[str, Any],
        context: Optional[dict[str, Any]] = None,
    ) -> PlannerOutput:
        """Build a PlannerOutput from policy, fallback, or default remediation options."""
        actions = self._lookup_or_fallback(diagnosis, snapshot, context)

        planner_actions: list[PlannerAction] = []
        for action in actions:
            risk_level = self._to_risk_level(action.get("risk", "medium"))

            approval_required = bool(action.get("approval_required", False))
            if risk_level in {RiskLevel.MEDIUM, RiskLevel.HIGH}:
                approval_required = True

            simulated_action = dict(action)
            simulated_action["approval_required"] = approval_required
            simulation = simulate_action(simulated_action, snapshot)

            if simulation.dependency_impact.value == "broad" and not approval_required:
                approval_required = True
                simulated_action["approval_required"] = True
                simulation = simulate_action(simulated_action, snapshot)

            planner_actions.append(
                PlannerAction(
                    action=str(action.get("command", "")),
                    description=str(action.get("description", "Planned remediation action")),
                    risk_level=risk_level,
                    expected_outcome=str(
                        action.get(
                            "expected_outcome",
                            "Service health improves after action execution",
                        )
                    ),
                    confidence=float(diagnosis.get("confidence", 0.5)),
                    approval_required=approval_required,
                    estimated_token_cost=0.0,
                    actual_token_cost=0.0,
                    simulation_result=simulation,
                )
            )

        # Keep highest-confidence first for execution ordering.
        planner_actions.sort(key=lambda item: item.confidence, reverse=True)
        return PlannerOutput(actions=planner_actions)

    def _lookup_or_fallback(
        self,
        diagnosis: dict[str, Any],
        snapshot: dict[str, Any],
        context: Optional[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Resolve policy actions first, then fall back to suggested or safe default actions."""
        fingerprint_id = diagnosis.get("fingerprint_id")
        policy_actions = lookup_policy(str(fingerprint_id), context or {}) if fingerprint_id else None
        if policy_actions:
            return policy_actions

        suggested_actions = [
            str(item).strip()
            for item in diagnosis.get("suggested_actions", [])
            if str(item).strip()
        ]
        if suggested_actions:
            ctx = context or {}
            return [
                {
                    "action_id": f"llm-alt-{idx + 1}",
                    "command": self._to_executable_command(action, ctx),
                    "risk": "medium",
                    "approval_required": True,
                    "blast_radius_score": 0.3,
                    "description": action,
                    "expected_outcome": "Symptoms reduce after applying suggested remediation",
                }
                for idx, action in enumerate(suggested_actions)
            ]

        deployment = str((context or {}).get("deployment", "<deployment>"))
        namespace = str((context or {}).get("namespace", "default"))
        return [
            {
                "action_id": "safe-default-restart",
                "command": f"kubectl rollout restart deployment/{deployment} -n {namespace}",
                "risk": "medium",
                "approval_required": False,
                "blast_radius_score": 0.2,
                "description": "Conservative default action when no policy or AI suggestion exists",
                "expected_outcome": "Transient failures may clear after restart",
            }
        ]

    def _to_risk_level(self, raw: Any) -> RiskLevel:
        """Map a free-form risk label to the canonical RiskLevel enum."""
        value = str(raw).lower()
        if value == RiskLevel.LOW.value:
            return RiskLevel.LOW
        if value in {RiskLevel.HIGH.value, "critical"}:
            return RiskLevel.HIGH
        return RiskLevel.MEDIUM

    def _to_executable_command(self, suggestion: str, context: dict[str, Any]) -> str:
        """Map free-text suggestions to safe, allowlisted kubectl commands."""
        text = suggestion.lower()
        deployment = str(context.get("deployment", "<deployment>"))
        namespace = str(context.get("namespace", "default"))

        if "rollback" in text or "undo" in text:
            return f"kubectl rollout undo deployment/{deployment} -n {namespace}"
        if "scale" in text or "replica" in text:
            return f"kubectl scale deployment/{deployment} -n {namespace} --replicas=3"
        if "resource" in text or "memory" in text:
            return f"kubectl set resources deployment/{deployment} -n {namespace} --limits=memory=2Gi"
        return f"kubectl rollout restart deployment/{deployment} -n {namespace}"
