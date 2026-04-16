# Running the System: Quick Start & Demo

## Prerequisites

- Python 3.13
- pip package manager
- Git
- PowerShell (on Windows) or bash (on macOS/Linux)

---

## Installation (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/VivekNeer/hacktofuture4-A07.git
cd hacktofuture4-A07
```

### 2. Create Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\Activate.ps1

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

**What gets installed**:

- FastAPI 0.115.0
- Pydantic 2.9.2
- pytest 8.3.3
- requests 2.32.3
- uvicorn (for running server)

### 4. Verify Installation

```bash
pytest backend/tests/ -q
```

**Expected output**:

```
.....................................                [100%]
====== 37 passed in 0.65s ======
```

---

## Demo: 3-Minute Walkthrough

### Part 1: Run All Tests (30 seconds)

```bash
cd c:\Users\vivek\projects\hacktofuture\hacktofuture4-A07

# Run all 37 tests
pytest backend/tests/ -v

# Expected: All pass ✅
```

### Part 2: Diagnosis Demo (1 minute)

Create a test script to run diagnosis:

```python
# demo_diagnosis.py
from backend.diagnosis.rule_engine import match_fingerprints
from backend.models.schemas import IncidentSnapshot

# Create incident snapshot (OOM scenario)
snapshot = IncidentSnapshot(
    incident_id="demo-001",
    service="api-gateway",
    namespace="prod",
    timestamp="2024-04-16T10:23:15Z",
    metrics={
        "cpu_pct": 45,
        "memory_pct": 95,
        "restart_count": 2,
        "latency_delta": "1.1x",
    },
    events=[
        {"reason": "OOMKilled", "message": "Out of memory", "timestamp": "2024-04-16T10:23:15Z"},
    ],
    logs_summary=[
        {"signature": "memory exhaustion", "count": 5, "severity": "critical"},
    ],
)

# Run diagnosis
matches = match_fingerprints(snapshot)

# Print results
print("\n=== DIAGNOSIS RESULTS ===")
for match in matches:
    print(f"\nFingerprint: {match.fingerprint_id}")
    print(f"Root Cause: {match.root_cause}")
    print(f"Confidence: {match.confidence:.0%}")
    print(f"Affected Services: {', '.join(match.affected_services)}")
    print(f"Recommended Fix: {match.recommended_fix}")
```

**Run it**:

```bash
python demo_diagnosis.py
```

**Expected output**:

```
=== DIAGNOSIS RESULTS ===

Fingerprint: FP-001
Root Cause: memory exhaustion: container exceeded memory limit
Confidence: 95%
Affected Services: api-gateway
Recommended Fix: increase memory limit or restart pod to clear state
```

### Part 3: Planner Demo (1 minute)

Create a planner demo:

```python
# demo_planner.py
from backend.planner.policy_ranker import plan_remediation
from backend.models.schemas import DiagnosisPayload
from backend.models.enums import DiagnosisMode, FailureClass, Severity, DependencyImpact

# Create diagnosis payload
diagnosis = DiagnosisPayload(
    incident_id="demo-001",
    diagnosis_mode=DiagnosisMode.RULE_BASED,
    root_cause="memory exhaustion: container exceeded memory limit",
    confidence=0.95,
    failure_class=FailureClass.RESOURCE,
    reasoning="OOMKilled event + 95% memory indicates kernel OOM killer triggered",
    evidence=["OOMKilled event present", "memory_pct=95", "restart_count=2"],
    affected_services=["api-gateway"],
    severity=Severity.CRITICAL,
    dependency_impact=DependencyImpact.CASCADED,
    fingerprint_id="FP-001",
)

# Run planner
plan_output = plan_remediation(diagnosis)

# Print results
print("\n=== PLANNER OUTPUT ===")
print(f"Root Cause: {plan_output.root_cause}")
print(f"Confidence: {plan_output.confidence:.0%}")
print(f"\nRanked Actions:")

for i, action in enumerate(plan_output.ranked_actions, 1):
    print(f"\n[{i}] {action.risk_level.upper()} RISK (Policy: {action.policy_id})")
    print(f"    Command: {action.command}")
    print(f"    Description: {action.description}")
    print(f"    Est. Duration: {action.estimated_duration_seconds}s")
```

**Run it**:

```bash
python demo_planner.py
```

**Expected output**:

```
=== PLANNER OUTPUT ===
Root Cause: memory exhaustion: container exceeded memory limit
Confidence: 95%

Ranked Actions:

[1] LOW RISK (Policy: POL-001)
    Command: kubectl rollout restart deployment/api-gateway -n prod
    Description: Restart all pods in the deployment
    Est. Duration: 30s

[2] MEDIUM RISK (Policy: POL-002)
    Command: kubectl patch deployment api-gateway -n prod -p '{...}'
    Description: Increase memory limit from 256Mi to 512Mi
    Est. Duration: 60s
```

---

## Common Scenarios to Test

### Scenario 1: Crash Loop Detection

```python
# test_crash_loop.py
from backend.diagnosis.rule_engine import match_fingerprints
from backend.models.schemas import IncidentSnapshot

snapshot = IncidentSnapshot(
    incident_id="crash-loop-demo",
    service="worker",
    namespace="prod",
    timestamp="2024-04-16T10:23:15Z",
    metrics={
        "cpu_pct": 20,
        "memory_pct": 30,
        "restart_count": 8,  # High restart count
        "latency_delta": "1.2x",
    },
    events=[
        {"reason": "CrashLoopBackOff", "message": "Back-off restarting failed container"},
    ],
    logs_summary=[
        {"signature": "TypeError: NoneType", "count": 15},
    ],
)

matches = match_fingerprints(snapshot)
print(f"Detected: {matches[0].root_cause}")
print(f"Confidence: {matches[0].confidence:.0%}")
# Expected: FP-002 with 0.90 confidence
```

### Scenario 2: Image Pull Failure

```python
# test_image_pull.py
snapshot = IncidentSnapshot(
    incident_id="image-pull-demo",
    service="api",
    namespace="prod",
    timestamp="2024-04-16T10:23:15Z",
    metrics={
        "cpu_pct": 0,
        "memory_pct": 0,
        "restart_count": 0,
        "latency_delta": "1.0x",
    },
    events=[
        {"reason": "ImagePullBackOff", "message": "Failed to pull image 'myrepo/api:bad-tag'"},
    ],
    logs_summary=[],
)

matches = match_fingerprints(snapshot)
print(f"Detected: {matches[0].root_cause}")
# Expected: FP-003 with 0.92 confidence
```

### Scenario 3: Database Connection Pool Saturation

```python
# test_db_pool.py
snapshot = IncidentSnapshot(
    incident_id="db-pool-demo",
    service="api",
    namespace="prod",
    timestamp="2024-04-16T10:23:15Z",
    metrics={
        "cpu_pct": 30,
        "memory_pct": 40,
        "restart_count": 0,
        "latency_delta": "3.5x",  # High latency spike
    },
    events=[],
    logs_summary=[
        {"signature": "connection timeout: pool exhausted", "count": 20},
        {"signature": "database connection refused", "count": 15},
    ],
)

matches = match_fingerprints(snapshot)
print(f"Detected: {matches[0].root_cause}")
# Expected: FP-005 with 0.82 confidence
```

---

## Running Tests with Coverage

```bash
# Generate HTML coverage report
pytest backend/tests/ --cov=backend --cov-report=html

# Open in browser
# Windows
start htmlcov/index.html

# macOS
open htmlcov/index.html

# Linux
xdg-open htmlcov/index.html
```

---

## Debugging Tips

### 1. Print Debug Info

```bash
# Run tests with print output
pytest backend/tests/ -v -s

# Run specific test
pytest backend/tests/test_diagnosis_agents.py::test_fp001_oom_matched -v -s
```

### 2. Check Python Version

```bash
python --version
# Expected: Python 3.13.x
```

### 3. List Installed Packages

```bash
pip list
```

### 4. Run Individual Agent

```python
# Diagnosis agent only
from backend.diagnosis.rule_engine import match_fingerprints
snapshot = ...  # Your snapshot
result = match_fingerprints(snapshot)
print(result)

# Planner agent only
from backend.planner.policy_ranker import plan_remediation
diagnosis = ...  # Your diagnosis
result = plan_remediation(diagnosis)
print(result)
```

---

## File Structure for Reference

```
hacktofuture4-A07/
├── backend/
│   ├── diagnosis/
│   │   ├── rule_engine.py         # Fingerprint matching
│   │   ├── feature_extractor.py   # 13 feature extraction
│   │   └── llm_fallback.py        # LLM diagnosis
│   ├── planner/
│   │   └── policy_ranker.py       # Policy selection + ranking
│   ├── governance/
│   │   └── token_governor.py      # Budget enforcement
│   ├── models/
│   │   ├── enums.py               # All enum types
│   │   └── schemas.py             # All Pydantic models
│   ├── tests/
│   │   ├── test_diagnosis_agents.py      # 9 diagnosis tests
│   │   ├── test_llm_fallback.py          # 12 LLM tests
│   │   ├── test_planner_agents.py        # 11 planner tests
│   │   └── test_models_contract.py       # 4 model tests
│   └── main.py                    # FastAPI app (placeholder)
│
└── docs/
    └── agents/                    # THIS DOCUMENTATION
        ├── 00-overview.md
        ├── 01-phase1-diagnosis.md
        ├── 02-phase2-llm-fallback.md
        ├── 03-phase2-planner.md
        ├── 04-token-governance.md
        ├── 05-data-contracts.md
        ├── 06-testing-guide.md
        ├── 07-api-endpoints.md
        └── 08-running-the-system.md
```

---

## Next Steps

### Phase 3: Monitor & Diagnose Orchestration

- Implement Monitor Agent (signal collection)
- Implement 4-signal correlation (CPU, Memory, Latency, Events)
- Wire Diagnose Agent to HTTP endpoints

### Phase 4: Planner & Executor Orchestration

- Wire Planner Agent to HTTP endpoints
- Implement Executor Agent (apply approved actions)
- Add recovery verification

### Phase 5: Frontend & Dashboard

- Build interactive incident dashboard
- Live incident feed with real-time updates
- Ranked action approval UI
- Recovery timeline visualization

---

## Support

For issues or questions:

1. Check [06-testing-guide.md](06-testing-guide.md) for test failures
2. Check [02-phase2-llm-fallback.md](02-phase2-llm-fallback.md) for LLM integration issues
3. Review test cases for usage examples
4. Open GitHub issue with reproduction steps

---

## Summary

| Component               | Status       | Test Coverage    | Performance |
| ----------------------- | ------------ | ---------------- | ----------- |
| Phase 1: Rule Diagnosis | ✅ Complete  | 9 tests          | < 1ms       |
| Phase 2: LLM Fallback   | ✅ Complete  | 12 tests         | < 1s        |
| Phase 2: Planner        | ✅ Complete  | 11 tests         | < 1ms       |
| Models & Contracts      | ✅ Complete  | 4 tests          | < 1ms       |
| **Total**               | **✅ 37/37** | **100% passing** | **0.65s**   |

🚀 **Ready for Phase 3 integration!**
