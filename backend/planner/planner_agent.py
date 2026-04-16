from __future__ import annotations

from models.schemas import PlannerAction, PlannerOutput
from planner.plan_simulator import simulate_action
from planner.planner_ai import run_ai_planner
from planner.policy_ranker import lookup_policy


class PlannerAgent:
    def __init__(self, token_governor, db):
        self.governor = token_governor
        self.db = db

    def run(self, diagnosis, snapshot) -> PlannerOutput:
        actions = lookup_policy(diagnosis, snapshot)
        if not actions:
            actions = run_ai_planner(diagnosis, snapshot, self.governor, self.db)
        if not actions:
            actions = [
                {
                    "action": f"kubectl rollout restart deployment/{snapshot.scope.deployment} -n {snapshot.scope.namespace}",
                    "description": "Fallback safe restart action",
                    "risk_level": "medium",
                    "expected_outcome": "Service recovers to recent baseline",
                    "confidence": 0.60,
                    "approval_required": False,
                }
            ]

        planner_actions = []
        for action in actions:
            simulation = simulate_action(action, snapshot)
            planner_actions.append(
                PlannerAction(
                    action=action["action"],
                    description=action["description"],
                    risk_level=action["risk_level"],
                    expected_outcome=action["expected_outcome"],
                    confidence=float(action["confidence"]),
                    approval_required=bool(action.get("approval_required", False)),
                    estimated_token_cost=float(action.get("estimated_token_cost", 0.0)),
                    actual_token_cost=float(action.get("actual_token_cost", 0.0)),
                    simulation_result=simulation,
                )
            )

        planner_actions.sort(key=lambda item: item.confidence, reverse=True)
        return PlannerOutput(actions=planner_actions)
