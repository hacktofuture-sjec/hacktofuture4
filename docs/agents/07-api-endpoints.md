# API Endpoints: Integration Contracts

## Purpose

Phase 1 & 2 provides backend agents (Diagnosis, Planner) but not the HTTP endpoints. This document defines the expected API contracts for Phase 3 & 4 integration.

---

## Overview

```
Frontend/Monitor Agent
        ↓
    HTTP POST /api/v1/incidents
        ↓
    Backend (Diagnosis Agent)
        ↓
    HTTP GET /api/v1/incidents/{incident_id}/diagnosis
        ↓
    Backend (Planner Agent)
        ↓
    HTTP GET /api/v1/incidents/{incident_id}/plan
        ↓
    Frontend (displays ranked actions)
        ↓
    Human approves actions
        ↓
    HTTP POST /api/v1/incidents/{incident_id}/execute
        ↓
    Executor Agent applies remediation
```

---

## Phase 1 & 2: Agents Only (No HTTP Yet)

Currently, Diagnosis and Planner are implemented as Python modules only. Example usage:

```python
from backend.diagnosis.rule_engine import match_fingerprints
from backend.planner.policy_ranker import plan_remediation

# Step 1: Get incident snapshot from monitor
snapshot = get_incident_snapshot(incident_id)

# Step 2: Run diagnosis (rule-based + LLM fallback)
diagnosis = diagnose_incident(snapshot)  # Returns DiagnosisPayload

# Step 3: Run planner
planner_output = plan_remediation(diagnosis)  # Returns PlannerOutput

# Step 4: Send to executor/frontend (not yet implemented)
```

---

## Proposed Phase 3 Endpoints

### POST /api/v1/incidents

**Create incident from Monitor Agent telemetry.**

**Request**:

```json
{
  "service": "payments-api",
  "namespace": "prod",
  "metrics": {
    "cpu_pct": 85,
    "memory_pct": 92,
    "restart_count": 3,
    "latency_delta": "2.1x"
  },
  "events": [
    {
      "reason": "OOMKilled",
      "message": "Container killed due to memory limit",
      "timestamp": "2024-04-16T10:23:15Z"
    }
  ],
  "logs_summary": [
    {
      "signature": "memory exhaustion",
      "count": 12,
      "severity": "critical"
    }
  ],
  "context": {
    "namespace": "prod",
    "replicas": 3,
    "image_tag": "v1.2.3"
  }
}
```

**Response** (201 Created):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "status": "detected",
  "created_at": "2024-04-16T10:23:16Z"
}
```

---

### GET /api/v1/incidents/{incident_id}/diagnosis

**Retrieve diagnosis result.**

**Response** (200 OK):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "diagnosis_mode": "rule_based",
  "root_cause": "memory exhaustion: container exceeded memory limit",
  "confidence": 0.95,
  "failure_class": "resource",
  "reasoning": "OOMKilled event + 92% memory indicates kernel OOM killer triggered",
  "evidence": [
    "OOMKilled event present",
    "memory_pct_now=92",
    "memory_z_score=14.4"
  ],
  "affected_services": ["payments-api"],
  "severity": "critical",
  "dependency_impact": "cascaded",
  "fingerprint_id": "FP-001",
  "timestamp": "2024-04-16T10:23:20Z"
}
```

---

### GET /api/v1/incidents/{incident_id}/plan

**Retrieve planner output with ranked actions.**

**Response** (200 OK):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "root_cause": "memory exhaustion: container exceeded memory limit",
  "confidence": 0.95,
  "ranked_actions": [
    {
      "rank": 1,
      "command": "kubectl rollout restart deployment/payments-api -n prod",
      "description": "Restart all pods in deployment to clear memory state",
      "risk_level": "low",
      "policy_id": "POL-001",
      "confidence": 0.95,
      "estimated_duration_seconds": 30
    },
    {
      "rank": 2,
      "command": "kubectl patch deployment payments-api -n prod -p '{...}'",
      "description": "Increase memory limit from 256Mi to 512Mi",
      "risk_level": "medium",
      "policy_id": "POL-002",
      "confidence": 0.95,
      "estimated_duration_seconds": 60
    }
  ],
  "timestamp": "2024-04-16T10:23:25Z"
}
```

---

### POST /api/v1/incidents/{incident_id}/execute

**Submit approved actions for execution.**

**Request**:

```json
{
    "approved_action_ranks": [1],  # User approved only rank 1 (lowest risk)
    "approved_by": "sre-user@company.com",
    "approval_reason": "Approved restart; will monitor recovery"
}
```

**Response** (202 Accepted):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "status": "executing",
  "executor_job_id": "exec-job-001",
  "message": "Executing 1 approved action"
}
```

---

### GET /api/v1/incidents/{incident_id}/execution-status

**Check executor progress.**

**Response** (200 OK):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "executor_job_id": "exec-job-001",
  "status": "completed",
  "completed_actions": [
    {
      "rank": 1,
      "command": "kubectl rollout restart deployment/payments-api -n prod",
      "outcome": "success",
      "duration_seconds": 32,
      "logs": "deployment.apps/payments-api rolled out"
    }
  ],
  "failed_actions": [],
  "timestamp": "2024-04-16T10:23:58Z"
}
```

---

### GET /api/v1/incidents/{incident_id}/verification

**Check post-remediation recovery.**

**Response** (200 OK):

```json
{
  "incident_id": "inc-2024-04-16-001",
  "metrics_normalized": true,
  "service_healthy": true,
  "dependency_impact_resolved": true,
  "recovery_time_seconds": 120,
  "root_cause_confirmed": true,
  "suggested_prevention": "Increase memory limit from 256Mi to 512Mi and add memory alerts at 80%",
  "timestamp": "2024-04-16T10:25:58Z"
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid incident data",
  "details": "Missing required field: service",
  "timestamp": "2024-04-16T10:23:16Z"
}
```

### 404 Not Found

```json
{
  "error": "Incident not found",
  "incident_id": "inc-2024-04-16-999",
  "timestamp": "2024-04-16T10:23:16Z"
}
```

### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "retry_after_seconds": 60,
  "timestamp": "2024-04-16T10:23:16Z"
}
```

### 500 Internal Server Error

```json
{
  "error": "Unexpected error during diagnosis",
  "request_id": "req-12345",
  "timestamp": "2024-04-16T10:23:16Z"
}
```

---

## Authentication & Authorization (Future)

All endpoints should be protected by:

- API key for service-to-service calls (Monitor → Backend)
- OAuth2/JWT for user-initiated approval (Frontend → Backend)
- Role-based access control (SRE can approve; Devs read-only)

---

## Rate Limiting (Future)

- Incident creation: 100 requests/minute per service
- Diagnosis/Planner queries: 1000 requests/minute per user
- Execute: 10 requests/minute per user

---

## Monitoring & Observability

Each endpoint should log:

- Request ID (unique per request)
- Incident ID
- User/service calling the API
- Response time
- Outcome (success/error)

Example:

```
[2024-04-16 10:23:16] req-12345 | POST /api/v1/incidents | service=payments-api | status=201 | duration=145ms
[2024-04-16 10:23:20] req-12346 | GET /api/v1/incidents/inc-001/diagnosis | user=sre-user | status=200 | duration=32ms
```

---

## Integration Testing Example

```python
import requests
import json

# 1. Create incident
incident_data = {
    "service": "payments-api",
    "namespace": "prod",
    "metrics": {"cpu_pct": 85, "memory_pct": 92, ...},
    "events": [...],
    "logs_summary": [...],
}

response = requests.post("http://localhost:8000/api/v1/incidents", json=incident_data)
incident_id = response.json()["incident_id"]

# 2. Get diagnosis
response = requests.get(f"http://localhost:8000/api/v1/incidents/{incident_id}/diagnosis")
diagnosis = response.json()
print(f"Root cause: {diagnosis['root_cause']}")
print(f"Confidence: {diagnosis['confidence']}")

# 3. Get plan
response = requests.get(f"http://localhost:8000/api/v1/incidents/{incident_id}/plan")
plan = response.json()
for action in plan['ranked_actions']:
    print(f"[{action['risk_level']}] {action['description']}")

# 4. Submit approval
approval_data = {
    "approved_action_ranks": [1],  # Only approve low-risk restart
    "approved_by": "user@company.com"
}

response = requests.post(
    f"http://localhost:8000/api/v1/incidents/{incident_id}/execute",
    json=approval_data
)
print(f"Executor job: {response.json()['executor_job_id']}")
```

---

## Implementation Notes for Phase 3 & 4

### Backend Structure

```python
# backend/routers/incidents.py
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1", tags=["incidents"])

@router.post("/incidents", status_code=201)
async def create_incident(snapshot: IncidentSnapshot):
    """Create incident from telemetry."""
    ...

@router.get("/incidents/{incident_id}/diagnosis")
async def get_diagnosis(incident_id: str):
    """Retrieve diagnosis result."""
    ...

@router.get("/incidents/{incident_id}/plan")
async def get_plan(incident_id: str):
    """Retrieve planner output."""
    ...

@router.post("/incidents/{incident_id}/execute")
async def submit_approval(incident_id: str, approval: ApprovalRequest):
    """Submit human approval for actions."""
    ...
```

### Request/Response Models

```python
# backend/models/api.py
from pydantic import BaseModel

class IncidentCreateRequest(BaseModel):
    """Request body for POST /incidents"""
    service: str
    namespace: str = "default"
    metrics: Dict[str, Any]
    events: List[Dict[str, str]]
    logs_summary: List[Dict[str, Any]]
    context: Optional[Dict[str, Any]] = None

class ApprovalRequest(BaseModel):
    """Request body for POST /incidents/{id}/execute"""
    approved_action_ranks: List[int]
    approved_by: str
    approval_reason: Optional[str] = None

class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    details: Optional[str] = None
    timestamp: str
```

---

## Related Documentation

- [05-data-contracts.md](05-data-contracts.md) — Request/response model definitions
- [08-running-the-system.md](08-running-the-system.md) — How to test endpoints locally
