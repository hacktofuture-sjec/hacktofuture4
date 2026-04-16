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

## Branch Plan

- feature/backend-core-aravind
- feature/agents-rajatha
- feature/observation-kushal
- feature/frontend-vivek
- integration/e2e-stabilization

Merge order:

1. backend core + contracts
2. observation + monitor
3. diagnose + planner + governance
4. executor + verification + memory
5. frontend integration
6. tests and dry-run hardening
