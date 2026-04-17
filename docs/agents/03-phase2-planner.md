# Phase 2: Planner Agent — Policy Ranking & Action Generation

## Purpose

The Planner Agent translates a diagnosis (root cause + confidence) into ranked remediation actions. It uses a fixed policy catalog (5 policies), selects appropriate policies for the diagnosed root cause, and ranks actions by risk level for human approval.

**Key characteristics**:

- **Policy-driven**: 5 hardcoded policies mapping root causes to remediation actions
- **Risk-ranked**: Actions ranked by low/medium/high risk for human approval gates
- **Template-based**: Action commands parameterized with incident context
- **Context-aware**: Substitutes service name, namespace, image tags, etc. into action templates

---

## Component Position

```
DiagnosisPayload {root_cause, confidence, affected_services, features}
        ↓
    ┌─────────────────────────────────────────────────┐
    │           PLANNER AGENT                          │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Policy Selection                             │ │
    │ │ Map diagnosis → applicable policies         │ │
    │ └─────────────────────────────────────────────┘ │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Action Generation                            │ │
    │ │ Template substitution (service, namespace)  │ │
    │ └─────────────────────────────────────────────┘ │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Risk-Based Ranking                          │ │
    │ │ Sort by: risk level + confidence            │ │
    │ └─────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────┘
        ↓
    PlannerOutput {
        ranked_actions: [
            {action: "...", risk: "low", confidence: 0.95},
            {action: "...", risk: "medium", confidence: 0.90},
            ...
        ]
    }
        ↓
    → Human Approval Gate → Executor Agent
```

---

## File Reference

**Policy Ranker**: `backend/planner/policy_ranker.py` (~150 lines)  
**Tests**: `backend/tests/test_planner_agents.py` (11 tests)

---

## Policy Catalog (5 Policies)

Each policy maps root-cause keywords to remediation actions with risk levels.

### Policy 1: Pod Restart (Low Risk)

```python
{
    "id": "POL-001",
    "name": "restart_pod",
    "risk_level": "low",
    "applicable_to": [
        "crash loop",
        "memory exhaustion",
        "application error",
    ],
    "actions": [
        {
            "template": "kubectl rollout restart deployment/{service} -n {namespace}",
            "risk": "low",
            "description": "Restart all pods in the deployment"
        }
    ]
}
```

| Field           | Value                                    | Purpose                                |
| --------------- | ---------------------------------------- | -------------------------------------- |
| `id`            | POL-001                                  | Unique policy identifier               |
| `name`          | restart_pod                              | Human-readable name                    |
| `risk_level`    | low                                      | Overall policy risk classification     |
| `applicable_to` | ["crash loop", "memory exhaustion", ...] | Keywords matching diagnosis root cause |
| `actions`       | Array of action objects                  | Parametrized kubectl/API commands      |

**When to use**: Application crashing, restarting pod often clears transient state.

---

### Policy 2: Resource Scaling (Low Risk)

```python
{
    "id": "POL-002",
    "name": "scale_resources",
    "risk_level": "low",
    "applicable_to": [
        "infra saturation",
        "node resource pressure",
        "CPU starvation",
        "memory pressure",
    ],
    "actions": [
        {
            "template": "kubectl scale deployment {service} --replicas=3 -n {namespace}",
            "risk": "low",
            "description": "Scale up replicas to distribute load"
        },
        {
            "template": "kubectl patch deployment {service} -n {namespace} -p '{\"spec\":{\"template\":{\"spec\":{\"resources\":{\"requests\":{\"memory\":\"512Mi\",\"cpu\":\"250m\"}}}}}}' ",
            "risk": "low",
            "description": "Reduce per-pod resource requests to fit more pods"
        }
    ]
}
```

**When to use**: Cluster lacks resources; increasing replicas or reducing per-pod resource requirements helps.

---

### Policy 3: Deployment Rollback (Medium Risk)

```python
{
    "id": "POL-003",
    "name": "rollback_deployment",
    "risk_level": "medium",
    "applicable_to": [
        "crash loop",
        "image pull failure",
        "application crash",
        "recent change",
    ],
    "actions": [
        {
            "template": "kubectl rollout undo deployment/{service} -n {namespace}",
            "risk": "medium",
            "description": "Rollback to previous stable revision"
        }
    ]
}
```

**When to use**: Crash loops or image failures suggest recent bad deployment; rollback to last stable version.

**Risk**: Medium because rollback can hide problems (best used with code review to prevent re-deployment of same issue).

---

### Policy 4: Configuration Patch (Medium Risk)

```python
{
    "id": "POL-004",
    "name": "patch_configuration",
    "risk_level": "medium",
    "applicable_to": [
        "image pull failure",
        "registry credentials",
        "database connection pool",
        "config error",
    ],
    "actions": [
        {
            "template": "kubectl patch deployment {service} -n {namespace} -p '{\"spec\":{\"template\":{\"spec\":{\"imagePullSecrets\":[{{\"name\":\"registry-creds\"}}]}}}}' ",
            "risk": "medium",
            "description": "Update imagePullSecrets to fix image pull failures"
        }
    ]
}
```

**When to use**: Configuration issues (missing secrets, wrong image registry, pool settings).

**Risk**: Medium because patching config can introduce new misconfigurations if not reviewed.

---

### Policy 5: Service Failover (High Risk)

```python
{
    "id": "POL-005",
    "name": "failover_service",
    "risk_level": "high",
    "applicable_to": [
        "database failure",
        "complete service failure",
        "cascading failure",
    ],
    "actions": [
        {
            "template": "kubectl patch service {service} -n {namespace} -p '{\"spec\":{\"selector\":{\"version\":\"canary\"}}}' ",
            "risk": "high",
            "description": "Failover to canary/backup service"
        }
    ]
}
```

**When to use**: Primary service completely failed; switch to backup/canary instance.

**Risk**: High because it changes production traffic routing. Requires human approval + monitoring.

---

## Action Generation & Templating

### Context Extraction from Diagnosis

```python
def extract_action_context(diagnosis: DiagnosisPayload) -> Dict[str, str]:
    """Extract context variables for action template substitution."""
    return {
        "service": diagnosis.affected_services[0] if diagnosis.affected_services else "unknown",
        "namespace": diagnosis.context.get("namespace", "default"),
        "image_tag": diagnosis.context.get("image_tag", "latest"),
        "replicas": str(diagnosis.context.get("current_replicas", 1)),
        "memory_limit": diagnosis.context.get("memory_limit", "256Mi"),
        "cpu_limit": diagnosis.context.get("cpu_limit", "100m"),
    }
```

### Template Substitution

```python
def generate_action_command(
    template: str,
    context: Dict[str, str],
) -> str:
    """Substitute context variables into action template."""
    result = template
    for key, value in context.items():
        placeholder = "{" + key + "}"
        result = result.replace(placeholder, value)
    return result
```

**Example**:

```
Template:
"kubectl rollout restart deployment/{service} -n {namespace}"

Context:
{"service": "payments-api", "namespace": "prod"}

Result:
"kubectl rollout restart deployment/payments-api -n prod"
```

---

## Policy Selection Algorithm

```python
def select_applicable_policies(
    diagnosis: DiagnosisPayload,
    policy_catalog: List[Policy],
) -> List[Policy]:
    """Select policies applicable to the diagnosed root cause."""

    root_cause_lower = diagnosis.root_cause.lower()
    applicable = []

    for policy in policy_catalog:
        # Check if any policy keyword matches root cause
        for keyword in policy.applicable_to:
            if keyword in root_cause_lower:
                applicable.append(policy)
                break  # No need to check other keywords

    return applicable
```

**Matching logic**: Keyword substring search (case-insensitive).

**Example**:

```
Root cause: "database connection pool saturation"
Root cause lower: "database connection pool saturation"

Check each policy:
- POL-001 "restart_pod": Check "crash loop" in root_cause? NO
- POL-002 "scale_resources": Check "infra saturation" in root_cause? NO
- POL-003 "rollback_deployment": Check "crash loop" in root_cause? NO
- POL-004 "patch_configuration": Check "database connection pool" in root_cause? YES ✅
- POL-005 "failover_service": Check "database failure" in root_cause? NO (but could match "complete service failure")

Applicable policies: [POL-004, POL-005]
```

---

## Risk-Based Ranking

```python
def rank_actions(
    actions_list: List[Action],
    diagnosis_confidence: float,
) -> List[RankedAction]:
    """Rank actions by risk level + confidence."""

    # Define risk order (low < medium < high)
    risk_order = {"low": 0, "medium": 1, "high": 2}

    ranked = []
    for action in actions_list:
        ranked.append(RankedAction(
            action=action,
            risk_level=action.risk,
            confidence=diagnosis_confidence,  # Inherit from diagnosis
            rank_score=risk_order[action.risk],
        ))

    # Sort by risk (low first), then by confidence (high first)
    ranked.sort(
        key=lambda x: (x.rank_score, -x.confidence),
    )

    return ranked
```

**Sorting logic**:

1. **Primary**: Risk level (low < medium < high)
2. **Secondary**: Confidence (high to low)

**Result**: Lowest-risk, highest-confidence actions presented first to human for approval.

---

## Output Format

```python
@dataclass
class PlannerOutput:
    """Output from Planner Agent."""
    incident_id: str
    diagnosis_source: str  # "rule" or "llm_fallback"
    root_cause: str
    confidence: float

    ranked_actions: List[RankedAction]  # Sorted by risk + confidence

    @dataclass
    class RankedAction:
        command: str  # Actual kubectl/API command
        description: str
        risk_level: str  # "low", "medium", "high"
        policy_id: str  # "POL-001", etc.
        confidence: float  # Inherited from diagnosis
```

**Example output**:

```json
{
  "incident_id": "inc-2024-04-16-001",
  "diagnosis_source": "rule",
  "root_cause": "database connection pool saturation",
  "confidence": 0.82,
  "ranked_actions": [
    {
      "command": "kubectl patch deployment payments-api -n prod -p '{...}'",
      "description": "Increase database connection pool size",
      "risk_level": "low",
      "policy_id": "POL-004",
      "confidence": 0.82
    },
    {
      "command": "kubectl patch service db-primary -n prod -p '{...}'",
      "description": "Failover to database replica",
      "risk_level": "high",
      "policy_id": "POL-005",
      "confidence": 0.82
    }
  ]
}
```

---

## Test Coverage (11 Tests)

**File**: `backend/tests/test_planner_agents.py`

| Test                                            | What It Validates                                              |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `test_policy_selection_single_match`            | Keyword matching for applicable policies                       |
| `test_policy_selection_multiple_matches`        | Multiple policies matched for diagnosis                        |
| `test_policy_selection_no_matches`              | No applicable policies (fallback gracefully)                   |
| `test_action_context_extraction`                | Extract service, namespace, replicas from diagnosis            |
| `test_action_template_substitution`             | Substitute context variables into templates                    |
| `test_action_command_generation`                | Generate final kubectl command                                 |
| `test_risk_based_ranking_low_first`             | Low-risk actions ranked before medium/high                     |
| `test_risk_based_ranking_confidence_tiebreaker` | High-confidence actions ranked first when risk equal           |
| `test_ranked_actions_output_schema`             | Output conforms to PlannerOutput structure                     |
| `test_policy_ranker_end_to_end`                 | Full pipeline: diagnosis → policy selection → ranking → output |
| `test_planner_output_json_serialization`        | Output can be serialized to JSON                               |

---

## Running the Tests

```bash
cd hacktofuture4-A07

# Run planner tests
pytest backend/tests/test_planner_agents.py -v

# Example output
# test_policy_selection_single_match PASSED
# test_policy_selection_multiple_matches PASSED
# test_policy_selection_no_matches PASSED
# test_action_context_extraction PASSED
# test_action_template_substitution PASSED
# test_action_command_generation PASSED
# test_risk_based_ranking_low_first PASSED
# test_risk_based_ranking_confidence_tiebreaker PASSED
# test_ranked_actions_output_schema PASSED
# test_policy_ranker_end_to_end PASSED
# test_planner_output_json_serialization PASSED
# ===== 11 passed in 0.04s =====
```

---

## Example Walkthrough: Crash Loop Incident

**Diagnosis input**:

```json
{
  "root_cause": "application crash loop: repeated process exit due to code or config error",
  "confidence": 0.9,
  "affected_services": ["api-gateway"],
  "context": { "namespace": "prod" }
}
```

**Step 1: Policy Selection**

```
Root cause keywords: "application crash loop"
Check each policy:
- POL-001 "restart_pod": "crash loop" in root_cause? YES ✅
- POL-002 "scale_resources": "infra saturation" in root_cause? NO
- POL-003 "rollback_deployment": "crash loop" in root_cause? YES ✅
- POL-004 "patch_configuration": "config error" in root_cause? YES ✅
- POL-005 "failover_service": "database failure" in root_cause? NO

Applicable policies: [POL-001, POL-003, POL-004]
```

**Step 2: Action Generation**

```
POL-001 (restart_pod):
  Template: "kubectl rollout restart deployment/{service} -n {namespace}"
  Context: {service: "api-gateway", namespace: "prod"}
  → Command: "kubectl rollout restart deployment/api-gateway -n prod"

POL-003 (rollback_deployment):
  Template: "kubectl rollout undo deployment/{service} -n {namespace}"
  Context: {service: "api-gateway", namespace: "prod"}
  → Command: "kubectl rollout undo deployment/api-gateway -n prod"

POL-004 (patch_configuration):
  Template: "kubectl patch deployment {service}..."
  Context: {service: "api-gateway", namespace: "prod"}
  → Command: "kubectl patch deployment api-gateway..."
```

**Step 3: Risk-Based Ranking**

```
Risk order: low < medium < high

Actions:
- POL-001 (restart_pod): risk=low, confidence=0.90 → rank_score=0
- POL-003 (rollback_deployment): risk=medium, confidence=0.90 → rank_score=1
- POL-004 (patch_configuration): risk=medium, confidence=0.90 → rank_score=1

Sorted by (risk_score, -confidence):
1. POL-001 (low, 0.90)
2. POL-003 (medium, 0.90) [first medium-risk by appearance order]
3. POL-004 (medium, 0.90)
```

**Output to human for approval**:

```json
{
  "incident_id": "inc-crash-loop-001",
  "root_cause": "application crash loop: repeated process exit...",
  "confidence": 0.9,
  "ranked_actions": [
    {
      "rank": 1,
      "risk": "LOW",
      "command": "kubectl rollout restart deployment/api-gateway -n prod",
      "description": "Restart pod to clear transient state"
    },
    {
      "rank": 2,
      "risk": "MEDIUM",
      "command": "kubectl rollout undo deployment/api-gateway -n prod",
      "description": "Rollback to previous stable revision"
    },
    {
      "rank": 3,
      "risk": "MEDIUM",
      "command": "kubectl patch deployment api-gateway...",
      "description": "Update deployment configuration"
    }
  ]
}
```

**Human approval**: "Approve action 1 (low risk)" → Executor Agent applies `kubectl rollout restart deployment/api-gateway -n prod`

---

## Key Design Decisions

### 1. Keyword Substring Matching for Policy Selection

Simple, transparent substring matching (e.g., "crash loop" in "application crash loop") rather than ML-based similarity. This ensures policy selection is deterministic and explainable.

### 2. Risk-Based Ranking (not Confidence-Only)

Actions are ranked primarily by risk level, not diagnosis confidence. This prevents recommending high-risk actions just because confidence is high. Example: High-confidence failover (high-risk) ranked below low-confidence restart (low-risk).

### 3. Context-Aware Template Substitution

Action templates parameterized with incident context (service name, namespace, replicas, etc.) rather than hardcoded. This allows reusing the same policy across different services/namespaces.

### 4. Confidence Inheritance

All ranked actions inherit the diagnosis confidence. This prevents the false impression that different actions have different confidence levels—they all share the same underlying diagnosis.

### 5. No Automatic Execution

Planner only _recommends_ actions; Executor Agent applies them after human approval. This preserves human control over production changes.

---

## Integration Points

### Input: DiagnosisPayload

From Diagnosis Agent (Phase 1 or 2):

- `root_cause`: Root cause description
- `confidence`: Confidence score (0.0–1.0)
- `affected_services`: List of impacted services
- `context`: Additional context (namespace, image tag, replicas, etc.)

### Output: PlannerOutput

To Executor Agent:

- `ranked_actions`: List of actions sorted by risk + confidence
- Each action includes: command, description, risk level, policy ID, confidence

---

## Next: Token Governance (Deep Dive)

The token governor is used by LLM fallback to enforce budget constraints. See [04-token-governance.md](04-token-governance.md) for details on cost tracking and budget enforcement.
