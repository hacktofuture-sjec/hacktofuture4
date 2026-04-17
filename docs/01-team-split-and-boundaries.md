# A-07 Team Split (Conflict-Minimized)

## Team Owners

- Vivek: frontend and UI integration
- Aravind: backend core, database, routers, app lifecycle
- Rajatha: diagnosis, planning, LLM fallback, token governance
- Kushal: collectors, monitor, infra, scenarios, memory

## Directory Ownership

### Aravind (exclusive unless approved)

- backend/main.py
- backend/config.py
- backend/db.py
- backend/init_db.py
- backend/models/
- backend/routers/
- backend/websocket/

### Rajatha

- backend/diagnosis/
- backend/planner/
- backend/governance/token_governor.py
- shared/contracts/ai-prompts-and-json-shapes.md

### Kushal

- backend/collectors/
- backend/agents/monitor_agent.py
- backend/memory/
- backend/data/scenarios.json
- k8s/
- scripts/setup.sh
- scripts/port_forward.sh

### Vivek

- frontend/
- shared/contracts/frontend-backend-contract-notes.md
- demo script and UI flow notes in docs/

## Freeze Gates

### Gate 1 (must freeze first)

- backend/models/schemas.py
- backend/models/enums.py
- shared/contracts/api-contract.md
- frontend/lib/types.ts

### Gate 2

- Fingerprint IDs in diagnosis rules (FP-001 to FP-007)
- Planner policy IDs and action templates
- Scenario IDs and expected fingerprint mapping

### Gate 3 (demo lock)

- Endpoint response shapes
- WebSocket event payloads
- Frontend layout and panel ordering

## Cross-Team Interface Rules

- Router files call service/agent modules; keep business logic out of routers.
- Agent inputs and outputs are contract-first; no silent shape changes.
- Any change to a frozen file needs all affected owners to approve.
- Avoid editing another owner's directory directly; raise an issue or pair for a short session.

## Merge Status (Current Sprint)

✅ **Completed phases (merged to main)**:

1. Backend core + contracts (Aravind)
2. Monitor + collectors (Kushal)
3. Diagnose + planner + governance (Rajatha)
4. Executor + verification (Aravind + Rajatha, PR #5)

🔄 **In Progress**: 5. Frontend integration (Vivek) — WebSocket streaming, live dashboard 6. Signal Intelligence hardening (Kushal) — Real Loki/Tempo queries 7. Tests and demo stabilization (all)

**Active branches**:

- feature/frontend-vivek
- feature/observation-kushal (Loki/Tempo real integration)
- feature/phase5-dashboard (if applicable)
