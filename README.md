# RanOutOfTokens (A-07)

Agentic Self-Healing Cloud for Autonomous Kubernetes Operations

This repository is now split for 4 parallel contributors with minimum merge conflicts.

## Quick Navigation

- Sequential understanding summary: docs/00-sequential-doc-understanding.md
- Team ownership and boundaries: docs/01-team-split-and-boundaries.md
- Current implementation status: docs/02-day1-start-checklist.md
- Shared API contract freeze: shared/contracts/api-contract.md
- Shared AI JSON shape contract: shared/contracts/ai-prompts-and-json-shapes.md

## Quick Start

### Prerequisites

- Docker Desktop
- kubectl
- kind
- helm
- vcluster
- uv

Install uv:

- macOS: `brew install uv`
- Linux (Ubuntu/Debian): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Linux (Arch/EndeavourOS): `pacman -S uv`

### Setup & Start

```bash
# One-time setup: create Kind cluster + monitoring stack + Python 3.12 venv
# Daily start: activate venv + start backend + frontend
./scripts/start.sh

# Test fault injection
curl -X POST http://localhost:8000/inject-fault \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"oom-kill-001"}'

# Open Grafana UI
# URL: http://localhost:3300
# Login: admin / admin
```

The response from /inject-fault includes a live observability snapshot built from metrics, logs, events, and traces.

The setup automatically installs Python 3.12 and creates a dedicated venv; no manual Python management needed.

## Problem Statement

Kubernetes can restart failed pods, but it does not diagnose root cause across metrics, events, logs, and traces. In production, incident triage is still manual and slow.

## Proposed Solution

Build an agentic reliability loop that:

- detects anomalies from telemetry,
- diagnoses root cause with rule-first logic and optional AI fallback,
- ranks remediation by risk,
- executes approved actions safely,
- verifies recovery and stores incident memory.

## Team Split (Conflict-Minimized)

- Vivek: frontend and dashboard integration
- Aravind: backend core, routers, DB, app lifecycle
- Rajatha: diagnose/planner/governance and AI contracts
- Kushal: collectors, monitor, infra, scenarios, memory

Detailed ownership: docs/01-team-split-and-boundaries.md

## Repository Structure (Prepared for Parallel Work)

- backend/
- frontend/
- k8s/
- scripts/
- shared/contracts/
- docs/

## Freeze Gates

1. Freeze model and API contracts first:
   - backend/models/schemas.py
   - backend/models/enums.py
   - shared/contracts/api-contract.md
   - frontend/lib/types.ts
2. Freeze fingerprint IDs, policy IDs, and scenario IDs next.
3. Freeze demo payload shapes and frontend layout before final dry run.

## Branch Strategy

- feature/backend-core-aravind
- feature/agents-rajatha
- feature/observation-kushal
- feature/frontend-vivek
- integration/e2e-stabilization

Merge in this order:

1. Backend contracts and core skeleton
2. Observation and monitor
3. Diagnose/planner/governance
4. Executor/verification/memory
5. Frontend integration
6. Testing and dry-run hardening

## Next Immediate Step

Start with docs/02-day1-start-checklist.md and finish the first 90-minute sync gates before deeper implementation.
