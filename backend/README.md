# Backend Workspace

This backend is split to reduce merge conflicts.

## Owner Areas

- Core and routers: Aravind
- Diagnosis and planner: Rajatha
- Observation and monitor: Kushal

## Contract-First Rule

Do not change model and API shapes without updating:

- backend/models/
- shared/contracts/api-contract.md
- frontend/lib/types.ts

## Suggested first files

- main.py
- config.py
- db.py
- init_db.py
- models/enums.py
- models/schemas.py
