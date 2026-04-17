# API Contract Freeze Document

This file is the source of truth for endpoint request and response shapes used by both backend and frontend.

## Initial Freeze List

- GET /healthz
- GET /scenarios
- POST /inject-fault
- GET /incidents
- GET /incidents/{incident_id}
- GET /incidents/{incident_id}/timeline
- POST /incidents/{incident_id}/approve

## WebSocket Event Types

- incident_opened
- status_changed
- diagnosis_completed
- planner_completed
- execution_completed
- verification_completed

## Contract Rule

Any shape change requires:

1. backend model update
2. frontend type update
3. test update
4. documented note in PR description
