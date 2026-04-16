from __future__ import annotations

from models.schemas import DiagnosisPayload, IncidentSnapshot


POLICY_CATALOG = [
    {
        "failure_class": "resource_exhaustion",
        "actions": [
            {
                "action": "kubectl rollout restart deployment/{deployment} -n {namespace}",
                "description": "Restart pods to clear leaked resources and stale process state",
                "risk_level": "medium",
                "expected_outcome": "Memory and restart indicators return to baseline",
                "confidence": 0.85,
                "approval_required": False,
            },
            {
                "action": "kubectl set resources deployment/{deployment} --limits=memory=2Gi -n {namespace}",
                "description": "Increase memory limit to prevent repeated OOM",
                "risk_level": "medium",
                "expected_outcome": "OOM events stop under current load",
                "confidence": 0.79,
                "approval_required": False,
            },
        ],
    },
    {
        "failure_class": "application_crash",
        "actions": [
            {
                "action": "kubectl rollout undo deployment/{deployment} -n {namespace}",
                "description": "Rollback to last stable deployment revision",
                "risk_level": "high",
                "expected_outcome": "Crash loop terminates with previous revision",
                "confidence": 0.88,
                "approval_required": True,
            }
        ],
    },
    {
        "failure_class": "config_error",
        "actions": [
            {
                "action": "kubectl rollout restart deployment/{deployment} -n {namespace}",
                "description": "Restart deployment after configuration correction",
                "risk_level": "high",
                "expected_outcome": "Pods start cleanly with corrected config",
                "confidence": 0.76,
                "approval_required": True,
            }
        ],
    },
    {
        "failure_class": "dependency_failure",
        "actions": [
            {
                "action": "kubectl rollout restart deployment/{deployment} -n {namespace}",
                "description": "Restart service to reset dependency client state",
                "risk_level": "medium",
                "expected_outcome": "Latency and timeout signatures reduce",
                "confidence": 0.80,
                "approval_required": False,
            }
        ],
    },
]


def lookup_policy(diagnosis: DiagnosisPayload, snapshot: IncidentSnapshot) -> list[dict] | None:
    del diagnosis  # not used directly in phase implementation

    for entry in POLICY_CATALOG:
        if snapshot.failure_class.value == entry["failure_class"]:
            actions = []
            for raw in entry["actions"]:
                action = raw.copy()
                action["action"] = action["action"].format(
                    deployment=snapshot.scope.deployment,
                    namespace=snapshot.scope.namespace,
                )
                actions.append(action)
            return actions
    return None
