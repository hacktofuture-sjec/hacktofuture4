# Day-1 Parallel Start Checklist

## Team-wide First 90 Minutes

1. Create all four feature branches from main.
2. Finalize and freeze initial schemas and enums.
3. Finalize API contract draft for critical routes:
   - GET /healthz
   - GET /scenarios
   - POST /inject-fault
   - GET /incidents
   - GET /incidents/{id}
   - POST /incidents/{id}/approve
4. Confirm local environment variables and DB path strategy.

## Aravind Start Pack

1. Scaffold backend app, config, DB init, and router placeholders.
2. Add initial schemas and enums with strict validation.
3. Add health and incidents router skeletons.
4. Commit baseline contract and open PR early.

## Rajatha Start Pack

1. Implement diagnosis rule engine scaffold.
2. Implement planner policy ranker scaffold.
3. Add token governor interface and stubs.
4. Add JSON output parser contracts for AI fallback.

## Kushal Start Pack

1. Implement collector stubs for Prometheus, Loki, Tempo, and K8s events.
2. Implement monitor agent skeleton and incident snapshot builder.
3. Add baseline scenarios.json with 4 deterministic scenarios.
4. Add k8s manifests and monitoring values placeholders.

## Vivek Start Pack

1. Scaffold Next.js app structure and dashboard shell.
2. Create frontend types mirrored from frozen backend schema.
3. Implement basic incident feed and drawer placeholders.
4. Add websocket hook with reconnect strategy.

## End-of-Day Sync

1. Run one integration pass:
   - inject scenario
   - incident opens
   - diagnose returns payload
   - planner returns ranked actions
2. Confirm no contract drift between backend models and frontend types.
3. Decide next freeze point for day 2.
