from typing import Any, Optional


POLICY_CATALOG = [
    {
        "fingerprint_id": "FP-001",  # memory exhaustion
        "actions": [
            {
                "action_id": "act-1-001",
                "command": "kubectl rollout restart deployment/{deployment} -n {namespace}",
                "risk": "medium",
                "approval_required": True,
                "blast_radius_score": 0.3,
                "description": "Restart pod to clear memory state",
            },
            {
                "action_id": "act-1-002",
                "command": "kubectl set resources deployment/{deployment} -n {namespace} --limits=memory=2Gi",
                "risk": "medium",
                "approval_required": True,
                "blast_radius_score": 0.2,
                "description": "Increase memory limit",
            },
        ],
    },
    {
        "fingerprint_id": "FP-002",  # crash loop
        "actions": [
            {
                "action_id": "act-2-001",
                "command": "kubectl rollout undo deployment/{deployment} -n {namespace}",
                "risk": "high",
                "approval_required": True,
                "blast_radius_score": 0.5,
                "description": "Rollback to previous stable version",
            },
        ],
    },
    {
        "fingerprint_id": "FP-003",  # image pull failure
        "actions": [
            {
                "action_id": "act-3-001",
                "command": "kubectl set image deployment/{deployment} {container}={image}",
                "risk": "high",
                "approval_required": True,
                "blast_radius_score": 0.4,
                "description": "Update container image to correct version",
            },
        ],
    },
    {
        "fingerprint_id": "FP-004",  # CPU starvation
        "actions": [
            {
                "action_id": "act-4-001",
                "command": "kubectl scale deployment/{deployment} -n {namespace} --replicas=3",
                "risk": "low",
                "approval_required": False,
                "blast_radius_score": 0.1,
                "description": "Scale up replicas to distribute load",
            },
        ],
    },
    {
        "fingerprint_id": "FP-005",  # DB connection pool
        "actions": [
            {
                "action_id": "act-5-001",
                "command": "kubectl set env deployment/{deployment} -n {namespace} DB_POOL_SIZE=50",
                "risk": "medium",
                "approval_required": True,
                "blast_radius_score": 0.2,
                "description": "Increase database connection pool size",
            },
        ],
    },
]


def lookup_policy(fingerprint_id: str, context: Optional[dict[str, Any]] = None) -> Optional[list[dict[str, Any]]]:
    """
    Look up policy actions for a given fingerprint.
    Returns ranked list of actions or None if no policy matches.
    """
    _ = context or {}

    for policy in POLICY_CATALOG:
        if policy["fingerprint_id"] == fingerprint_id:
            return policy["actions"]

    return None


def rank_actions_by_risk(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Rank actions by risk level: low → medium → high.
    Among same risk, prioritize lower blast_radius.
    """
    risk_order = {"low": 0, "medium": 1, "high": 2}
    return sorted(
        actions,
        key=lambda a: (risk_order.get(a.get("risk", "high"), 999), a.get("blast_radius_score", 1.0)),
    )

