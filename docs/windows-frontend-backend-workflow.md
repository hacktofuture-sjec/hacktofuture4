# Windows Frontend-Backend Workflow

This guide explains how the Windows start script, backend API, frontend dashboard, and injection flow work together.

## Files You Will Use

- [scripts/windows-setup.ps1](../scripts/windows-setup.ps1)
- [scripts/windows-start.ps1](../scripts/windows-start.ps1)
- [scripts/windows-stop.ps1](../scripts/windows-stop.ps1)
- [frontend/lib/api.ts](../frontend/lib/api.ts)
- [frontend/hooks/useWebSocket.ts](../frontend/hooks/useWebSocket.ts)
- [frontend/components/controls/FaultInjector.tsx](../frontend/components/controls/FaultInjector.tsx)
- [frontend/app/page.tsx](../frontend/app/page.tsx)

## What The Start Script Does

When you run `scripts/windows-start.ps1`, it starts and tracks these pieces:

1. Port-forwards Prometheus on `http://localhost:9090`
2. Port-forwards Loki on `http://localhost:3100`
3. Port-forwards Tempo on `http://localhost:3200`
4. Port-forwards Grafana on `http://localhost:3300`
5. Starts the FastAPI backend on `http://localhost:8000`
6. Loads the demo scenarios into the backend database
7. Starts the frontend on `http://localhost:3000` if the frontend folder exists

The script writes process IDs and logs into `.run/` so you can stop or inspect them later.

## How The Frontend Talks To The Backend

The frontend uses two transport paths:

### HTTP API

`frontend/lib/api.ts` builds the base URL like this:

- `NEXT_PUBLIC_API_URL` if you set it
- otherwise `http://localhost:8000`

That means all dashboard HTTP calls go to the backend directly unless you override the environment variable.

Examples of HTTP calls:

- `GET /healthz` for health state
- `GET /incidents` for the incident list
- `GET /scenarios` to populate the fault injector dropdown
- `POST /inject-fault` to trigger a scenario
- `POST /incidents/{id}/diagnose`, `/plan`, `/approve`, `/execute`, `/verify` for the incident lifecycle

### WebSocket Updates

`frontend/hooks/useWebSocket.ts` connects to:

- `NEXT_PUBLIC_WS_URL` if set
- otherwise `ws://localhost:8000/ws`

The dashboard listens for messages like:

- `incident_event`
- `status_change`
- `diagnosis_complete`
- `plan_ready`
- `execution_update`
- `incident_resolved`

When one of those arrives, the incident list reloads automatically.

## How Injection Shows Up In The UI

The flow is:

1. You choose a scenario in the Fault Injector dropdown.
2. `FaultInjector.tsx` calls `api.injectFault(selectedScenarioId)`.
3. The backend receives `POST /inject-fault`.
4. The backend looks up the scenario in SQLite.
5. The backend runs the configured fault command and collects a snapshot.
6. The backend broadcasts a websocket update.
7. The frontend receives the update and reloads the incident list.
8. You can open the incident drawer to inspect diagnosis, plan, executor state, and verification.

If the Kubernetes cluster is not reachable, injection can fail with HTTP 500 because the backend cannot run the `kubectl` action in the scenario.

## Continuous Workflow

Use this sequence every day:

1. Start Docker Desktop.
2. Run `scripts/windows-start.ps1`.
3. Open the frontend at `http://localhost:3000`.
4. Watch the connection badge in the header.
5. Inject a scenario from the dashboard.
6. Open the incident drawer to follow diagnosis and plan progression.
7. Open Grafana at `http://localhost:3300` if you want to inspect monitoring data.
8. Use the backend docs at `http://localhost:8000/docs` to call any API directly.
9. When done, run `scripts/windows-stop.ps1`.

## What To Look At While It Runs

### Frontend

- Top-right connection badge shows websocket state.
- Fault injector dropdown lists scenarios from the backend.
- Incident feed refreshes automatically.
- Clicking an incident opens the drawer with the full lifecycle.

### Backend

- `GET /healthz` confirms the service is up.
- `POST /admin/load-scenarios` seeds the scenario table.
- `POST /inject-fault` is the main trigger for the demo flow.
- `GET /incidents` shows the stored incident list.

### Monitoring

- Prometheus: `http://localhost:9090`
- Loki: `http://localhost:3100/ready`
- Tempo: `http://localhost:3200/ready`
- Grafana: `http://localhost:3300`

## If You Want A Quick Sanity Check

Run these after the start script finishes:

```powershell
curl http://localhost:8000/healthz
curl http://localhost:8000/scenarios
curl http://localhost:9090/-/healthy
curl http://localhost:3100/ready
curl http://localhost:3200/ready
curl http://localhost:3300/api/health
```

If those pass, the frontend should be able to talk to the backend and the full continuous workflow is ready.
