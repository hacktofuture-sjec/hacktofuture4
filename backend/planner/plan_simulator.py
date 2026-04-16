from __future__ import annotations

from models.schemas import IncidentSnapshot


def compute_blast_radius(action: dict, snapshot: IncidentSnapshot) -> float:
    score = 0.0

    command = action.get("action", "")
    if "rollout restart" in command:
        score += 0.3
    if "rollout undo" in command:
        score += 0.5
    if "set resources" in command or "set image" in command:
        score += 0.2
    if "scale deployment" in command:
        score += 0.1

    if "bottleneck" in snapshot.dependency_graph_summary.lower() or "high error rate" in snapshot.dependency_graph_summary.lower():
        score += 0.15

    return min(round(score, 2), 1.0)


def check_rollback_ready(action: dict) -> bool:
    command = action.get("action", "")
    if "rollout undo" in command:
        return True
    return True


def assess_dependency_impact(action: dict, snapshot: IncidentSnapshot) -> str:
    command = action.get("action", "")
    if "rollout undo" in command or "set image" in command:
        if "bottleneck" in snapshot.dependency_graph_summary.lower() or "high error rate" in snapshot.dependency_graph_summary.lower():
            return "broad"
        return "limited"
    if "rollout restart" in command:
        return "limited"
    if "scale deployment" in command or "set resources" in command:
        return "none"
    return "limited"


def simulate_action(action: dict, snapshot: IncidentSnapshot) -> dict:
    blast = compute_blast_radius(action, snapshot)
    rollback_ready = check_rollback_ready(action)
    impact = assess_dependency_impact(action, snapshot)

    violations: list[str] = []
    if not rollback_ready and action.get("risk_level") == "high":
        violations.append("no_rollback_available_for_high_risk_action")

    if impact == "broad" and not action.get("approval_required", False):
        violations.append("broad_dependency_impact_requires_approval")
        action["approval_required"] = True

    return {
        "blast_radius_score": blast,
        "rollback_ready": rollback_ready,
        "dependency_impact": impact,
        "policy_violations": violations,
    }
