# Monitor → Diagnose → Plan Pipeline - Implementation Complete ✅

## Overview

The incident response pipeline has been successfully implemented and aligned with the documented specifications. All three agent stages (Monitor, Diagnose, Plan) are now properly integrated through REST endpoints with validated data contracts.

## What Was Built

### 1. Monitor Stage ✅
**Endpoint:** `GET /incidents` | `GET /incidents/{id}`

Collects incident snapshots with:
- Kubernetes pod metrics (CPU, memory, restart count)
- Log signatures and event traces
- Service and dependency information
- Confidence scores and failure classification

**Output Model:** `IncidentSnapshot`

### 2. Diagnose Stage ✅ [NEW]
**Endpoint:** `POST /incidents/{id}/diagnose`

Analyzes incident snapshots using:
- **Rule Engine**: 5 fingerprints for OOM, crash-loop, image-pull, CPU, DB-latency
- **Feature Extractor**: Engineered features from metrics/logs
- **AI Fallback**: LLM-based diagnosis if rule confidence < 0.75
- **Conflict Detection**: Identifies contradicting signals

**Output Model:** `DiagnosisPayload`

### 3. Plan Stage ✅ [UPDATED]
**Endpoint:** `POST /incidents/{id}/plan`

Generates recovery actions using:
- **Policy Lookup**: Maps root cause → recommended actions
- **Action Ranking**: Sorts by risk level and confidence
- **Simulation**: Predicts outcomes before execution
- **Approval Gates**: Requires approval for high-risk actions

**Output Model:** `PlannerOutput`

## Key Changes

### Added: `/diagnose` Endpoint
**File:** [backend/routers/incidents.py](backend/routers/incidents.py#L163-L185)

```python
@router.post("/{incident_id}/diagnose")
def diagnose_incident(incident_id: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run DiagnoseAgent on the stored IncidentSnapshot and persist the result."""
    incident = _find_incident(incident_id)
    
    # Ensure snapshot exists
    if "snapshot" not in incident or not incident["snapshot"]:
        raise HTTPException(status_code=400, detail="No snapshot found for this incident")
    
    snapshot = incident["snapshot"]
    diagnosis = diagnose_snapshot(snapshot)
    incident["diagnosis"] = diagnosis
    incident["diagnosed_at"] = datetime.now(timezone.utc).isoformat()
    incident["status"] = "diagnosing"
    
    return {
        "incident_id": incident_id,
        "status": incident["status"],
        "diagnosis": diagnosis,
    }
```

### Updated: `/plan` Endpoint Logic
**File:** [backend/routers/incidents.py](backend/routers/incidents.py#L197-L201)

```python
# Prefer stored diagnosis if available (from /diagnose endpoint), 
# otherwise generate fresh
snapshot = incident.get("snapshot") or body.get("snapshot") or collect_monitor_snapshot()
diagnosis = incident.get("diagnosis") or body.get("diagnosis") or diagnose_snapshot(snapshot)
incident["snapshot"] = snapshot
```

### Fixed: Feature Key Name Mismatch
**File:** [backend/diagnosis/diagnose_agent.py](backend/diagnosis/diagnose_agent.py#L61)

```python
# Changed from: features["crashloop_event_count"]
# To: features["crash_loop_event_count"]
if features["crash_loop_event_count"] > 0 and features["restart_count"] == 0:
    conflicts.append("CrashLoopBackOff event but restarts at 0")
```

## Data Contracts

All data flows now validated through Pydantic models with complete field contracts:

### IncidentSnapshot (Monitor → Diagnose)
```python
{
  "incident_id": str,
  "alert": str,
  "service": str,
  "pod": str,
  "metrics": {
    "cpu_usage_percent": float,
    "memory_usage_percent": float,
    "restart_count": int,
    "latency_delta_x": float
  },
  "events": list[EventRecord],
  "logs_summary": list[LogSignature],
  "trace_summary": Optional[TraceSpan],
  "scope": {"namespace": str, "deployment": str},
  "monitor_confidence": float,
  "failure_class": str,
  "dependency_graph_summary": str
}
```

### DiagnosisPayload (Diagnose → Plan)
```python
{
  "root_cause": str,
  "confidence": float,  # 0.0-1.0
  "diagnosis_mode": str,  # "rule" | "ai"
  "fingerprint_matched": str,  # "FP-001" or False
  "affected_services": list[str],
  "evidence": list[dict],
  "structured_reasoning": {
    "matched_rules": list[str],
    "conflicting_signals": list[str],
    "missing_signals": list[str]
  }
}
```

### PlannerOutput (Plan result)
```python
{
  "actions": [
    {
      "command": str,
      "description": str,
      "risk_level": str,  # "low" | "medium" | "high"
      "expected_outcome": str,
      "confidence": float,  # 0.0-1.0
      "approval_required": bool,
      "simulation_result": Optional[dict]
    }
  ]
}
```

## Testing

### Unit Tests (No Dependencies) ✅
```bash
python3 test_pipeline_unit.py
```

Results:
- ✅ Monitor snapshot collection (all fields present)
- ✅ Diagnosis with DiagnoseAgent (all fields present, correct types)
- ✅ Planning with PlannerAgent (all fields present, correct ranges)
- ✅ Data type validation (string, float 0.0-1.0, enum values)

### Integration Tests (With Kubernetes)
```bash
bash test_pipeline.sh [fault_type]
# fault_type: oom-kill (default), cpu-spike, crash-loop, db-latency
```

## Fingerprints Supported

| ID | Name | Condition | Confidence |
|----|------|-----------|-----------|
| FP-001 | OOM Memory Exhaustion | OOMKilled + memory ≥90% | 0.95 |
| FP-002 | Crash Loop | CrashLoopBackOff + restarts ≥3 | 0.92 |
| FP-003 | Image Pull Failure | ImagePullBackOff | 0.90 |
| FP-004 | CPU Starvation | CPU ≥90% & memory <80% | 0.85 |
| FP-005 | DB Connection Pool Saturation | Latency >2.0x + timeout logs | 0.80 |

## Pipeline Execution Flow

```
1. Fault Injection
   ↓
2. Monitor collects IncidentSnapshot
   ├─ API: GET /incidents/{id}
   └─ Returns: {incident_id, alert, service, pod, metrics, events, logs...}
   ↓
3. Diagnose analyzes snapshot (NEW)
   ├─ API: POST /incidents/{id}/diagnose
   ├─ Process: Rule fingerprints → AI fallback
   └─ Returns: {root_cause, confidence, fingerprint_matched, evidence...}
   ↓
4. Plan generates recovery actions
   ├─ API: POST /incidents/{id}/plan
   ├─ Process: Policy lookup → action ranking → simulation
   └─ Returns: {actions: [{command, risk_level, approval_required...}]}
   ↓
5. Approval workflow (existing)
   ├─ API: POST /incidents/{id}/approve
   └─ Update incident status
   ↓
6. Execution (existing)
   ├─ API: POST /incidents/{id}/execute
   └─ Run actions in vCluster sandbox
   ↓
7. Verification (existing)
   ├─ API: POST /incidents/{id}/verify
   └─ Check if incident resolved
```

## Status Transitions

```
open
  ↓
diagnosing (via POST /diagnose)
  ↓
planned (via POST /plan)
  ↓
pending_approval (if approval_required = true)
  ↓
executing (via POST /approve then POST /execute)
  ↓
verifying (via POST /verify)
  ↓
resolved | failed
```

## Files Modified

| File | Type | Change |
|------|------|--------|
| `routers/incidents.py` | Route | Added `/diagnose` endpoint |
| `routers/incidents.py` | Route | Updated `/plan` to prefer stored diagnosis |
| `diagnosis/diagnose_agent.py` | Logic | Fixed feature key name mismatch |

## Files Created

| File | Purpose |
|------|---------|
| `test_pipeline_unit.py` | Standalone unit tests (no Kubernetes) |
| `test_pipeline.sh` | Bash script for integration testing |
| `PIPELINE_IMPLEMENTATION.md` | Detailed implementation docs |
| `WORK_SUMMARY.md` | Work completion summary |

## Dependencies

Already satisfied:
- ✅ FastAPI 0.115.0 (web framework)
- ✅ Pydantic 2.9.2 (data validation)
- ✅ Python 3.x (runtime)
- ✅ DiagnoseAgent (fingerprinting implementation)
- ✅ PlannerAgent (policy-based planner)
- ✅ MonitorAgent (metric collection)

## Quick Start

### 1. Verify Unit Tests
```bash
cd /home/arvind/Documents/htf_26/hacktofuture4-A07
python3 test_pipeline_unit.py
# Should see: ✓ All unit tests passed!
```

### 2. Test Full Pipeline
```bash
# Terminal 1: Start backend
cd backend
python main.py

# Terminal 2: Run integration test
bash test_pipeline.sh oom-kill
```

### 3. Manual API Testing
```bash
# Inject fault
curl -X POST http://localhost:8000/inject-fault \
  -H "Content-Type: application/json" \
  -d '{"fault_type": "oom-kill"}'
# Returns: {"incident_id": "incident-..."}

# Get incident snapshot
curl http://localhost:8000/incidents/incident-...

# Run diagnosis (NEW)
curl -X POST http://localhost:8000/incidents/incident-.../diagnose

# Generate plan
curl -X POST http://localhost:8000/incidents/incident-.../plan
```

## Validation Checklist

- ✅ New `/diagnose` endpoint added
- ✅ `/plan` endpoint updated to prefer stored diagnosis
- ✅ All three agents return correct Pydantic models
- ✅ Data contracts validated in unit tests
- ✅ Feature key names aligned with feature_extractor
- ✅ Fingerprints implemented and functional
- ✅ Confidence scoring in 0.0-1.0 range
- ✅ Risk levels properly categorized
- ✅ Approval gates applied correctly
- ✅ No syntax errors in modified files

## Known Limitations

1. **LLM Integration**: AI fallback requires configured endpoint; currently returns 0.50 confidence rule-only diagnosis
2. **vCluster Sandbox**: Plan simulator uses mock outcomes instead of actual sandbox execution
3. **Monitoring Services**: Backend startup checks Prometheus/Loki/Tempo availability
4. **State Machine**: Incident status updates are manual in route handlers (no enforcement)

## Next Steps

1. **Kubernetes Integration**: Deploy and test against real cluster
2. **Fault Scenarios**: Validate all 4 fault types work end-to-end
3. **LLM Configuration**: Connect to OpenAI/Claude API for AI fallback
4. **vCluster Connection**: Enable actual sandbox action simulation
5. **Production Hardening**: Add retry logic, better error handling, monitoring

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitor Stage                              │
│  ├─ K8s metrics (prometheus)                                  │
│  ├─ Log analysis (loki)                                       │
│  ├─ Trace correlation (tempo)                                 │
│  └─ → IncidentSnapshot (model)                                │
└────────────┬────────────────────────────────────────────────┘
             │
             ├→ GET /incidents/{id}
             │
             └→ POST /incidents/{id}/diagnose (NEW)
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                  Diagnose Stage                               │
│  ├─ Rule engine (5 fingerprints)                              │
│  ├─ Feature extraction                                        │
│  ├─ AI fallback (LLM optional)                                │
│  └─ → DiagnosisPayload (model)                                │
└────────────┬────────────────────────────────────────────────┘
             │
             └→ POST /incidents/{id}/plan
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    Plan Stage                                 │
│  ├─ Policy lookup                                             │
│  ├─ Action ranking                                            │
│  ├─ Outcome simulation                                        │
│  └─ → PlannerOutput (model)                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             └→ POST /incidents/{id}/approve
             → POST /incidents/{id}/execute
             → POST /incidents/{id}/verify
```

## Contact & Support

For questions about this implementation, refer to:
- [PIPELINE_IMPLEMENTATION.md](PIPELINE_IMPLEMENTATION.md) - Detailed technical docs
- [WORK_SUMMARY.md](WORK_SUMMARY.md) - Work completion checklist
- Source docs: `/docs/reference/{06,07,08}-agent-implementation.md`

---

**Implementation Status:** ✅ **COMPLETE**  
**Test Status:** ✅ **All unit tests passing**  
**Ready for:** Integration testing and fault scenario validation  
**Date:** 2025-03-21
