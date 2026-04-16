# Teammate Start-Now Plan (Independent First Commits)

## Vivek (Frontend)

Branch: feature/frontend-vivek

First commit scope:

1. Initialize frontend app shell and dashboard page.
2. Create frontend/lib/types.ts from frozen backend schema snapshot.
3. Add incident feed, drawer placeholders, and websocket hook skeleton.

Avoid editing:

- backend/
- k8s/

## Aravind (Backend Core)

Branch: feature/backend-core-aravind

First commit scope:

1. Create FastAPI app entry and lifecycle hooks.
2. Add config loader, DB connection factory, and DB initializer.
3. Create routers as placeholders with health and incidents list endpoints.

Avoid editing:

- frontend/
- k8s/

## Rajatha (Diagnosis + Planner)

Branch: feature/agents-rajatha

First commit scope:

1. Add diagnosis rule_engine skeleton with fingerprint IDs.
2. Add planner policy_ranker skeleton.
3. Add token_governor interfaces and AI JSON parser guards.

Avoid editing:

- backend/routers/
- frontend/

## Kushal (Observation + Infra)

Branch: feature/observation-kushal

First commit scope:

1. Add collectors for Prometheus, Loki, Tempo, and K8s events as stubs.
2. Add monitor agent skeleton and snapshot assembly stubs.
3. Add k8s baseline manifests and initial scenarios JSON.

Avoid editing:

- frontend/
- backend/diagnosis/
- backend/planner/

## Same-Day Integration Rule

At end of first working block, each person must expose one callable interface only:

- frontend: one page rendering incidents from mock data
- backend core: one health endpoint and one incidents endpoint
- diagnosis/planner: one deterministic function each returning typed payload
- observation/infra: one collector returning normalized sample output
