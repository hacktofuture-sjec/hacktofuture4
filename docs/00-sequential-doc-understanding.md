# Sequential Understanding From hacktofuture_docs

This is the exact build sequence extracted from the source documentation, with what each step must produce.

## 1. Config

Source: hacktofuture_docs/docs/config/01-environment-variables.md

- Define all environment variables first.
- Create .env.example and backend config loader.
- Keep local test overrides ready (especially DB_PATH and AI fallback flags).

## 2. Database

Source: hacktofuture_docs/docs/database/01-sqlite-schema.md

- Create SQLite schema and init flow.
- Implement connection factory and request-scoped DB dependency.
- Keep raw SQL query helpers centralized.

## 3. Schemas (Contract Freeze Point)

Source: hacktofuture_docs/docs/schemas/01-pydantic-models.md

- Define enums and all Pydantic contracts.
- This is the primary backend-frontend interface.
- Freeze early; later changes cause team-wide breakage.

## 4. Backend Service Structure

Source: hacktofuture_docs/docs/backend/01-service-structure.md

- Set up FastAPI project layout, app lifecycle, router mounts, and broadcaster wiring.

## 5. Router Implementations

Source: hacktofuture_docs/docs/backend/02-router-implementations.md

- Implement health, scenarios, fault injection, incidents, agents, memory, cost routes.
- Keep router files thin and delegate logic into modules.

## 6. Observation + Monitor

Sources:

- hacktofuture_docs/docs/reference/05-observation-layer-implementation.md
- hacktofuture_docs/docs/reference/04-four-signal-correlation-implementation.md
- hacktofuture_docs/docs/reference/06-monitor-agent-implementation.md
- Implement signal collectors and monitor flow to open incidents.

## 7. Diagnose + Planner + Governance

Sources:

- hacktofuture_docs/docs/reference/07-diagnose-agent-implementation.md
- hacktofuture_docs/docs/reference/08-planner-agent-implementation.md
- hacktofuture_docs/docs/reference/01-agent-intelligence-boundary.md
- hacktofuture_docs/docs/reference/03-token-and-cost-governance.md
- hacktofuture_docs/docs/reference/12-prompt-engineering-guide.md
- Keep rule-first logic with AI fallback and cost governance.

## 8. Executor + Verification + Learning

Sources:

- hacktofuture_docs/docs/reference/09-executor-agent-implementation.md
- hacktofuture_docs/docs/reference/10-verification-and-learning.md
- Implement safe execution path and recovery verification before incident close.

## 9. Scenarios

Source: hacktofuture_docs/docs/scenarios/01-fault-scenario-library.md

- Build deterministic fault scenarios.
- Use these for repeatable testing and demo.

## 10. Infra

Sources:

- hacktofuture_docs/docs/infra/01-kubernetes-manifests.md
- hacktofuture_docs/docs/infra/02-repository-structure.md
- Set up Kind, monitoring stack values, and sample services.

## 11. Frontend

Sources:

- hacktofuture_docs/docs/frontend/01-component-architecture.md
- hacktofuture_docs/docs/frontend/02-component-render-spec.md
- Implement dashboard that mirrors backend contracts exactly.

## 12. Scripts + Testing + Demo Runbook

Sources:

- hacktofuture_docs/docs/scripts/01-automation-scripts.md
- hacktofuture_docs/docs/testing/01-testing-protocol.md
- hacktofuture_docs/docs/execution/02-setup-and-demo-runbook.md
- Add setup/start/stop/dry-run scripts and lock acceptance tests.

## Global Context

Also used for planning and sequencing:

- hacktofuture_docs/docs/core/01-architecture-blueprint.md
- hacktofuture_docs/docs/core/02-build-phases.md
- hacktofuture_docs/docs/core/03-team-ownership.md
- hacktofuture_docs/docs/reference/11-api-endpoint-contracts.md
