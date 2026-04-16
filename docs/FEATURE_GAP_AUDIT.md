# UniOps Feature GAP AUDIT

Date: 2026-04-17
Source of scope: TO-DO.md

## 1. Baseline Policy and Scope

This audit follows the current product policy:

- External write operations are intentionally not executed from UniOps runtime.
- Execution behavior is planner-only for external actions (GitHub, Slack, Jira writes remain no-write by design).
- Human approval is still required for high-risk actions.
- The execution agent must return a clear action plan and audit trail, not a mutation claim.

This document converts TO-DO feature items into:

- current implementation percentage,
- implementation gaps,
- required implementation to close each gap,
- vertical-slice build order.

## 2. Scoring Method

Percentages are based on four checks per feature area:

1. API or runtime path exists.
2. Contract and metadata are complete and unambiguous.
3. Tests cover happy path and failure path.
4. Demo/operator readiness is verified and documented.

## 3. Feature-Wise Implementation Status and Required Work

| Feature Area | Current % | Current State | Implementation Required | Acceptance Criteria |
|---|---:|---|---|---|
| Controller pipeline with swarm chaining | 100% | Implemented and verified on main; retrieval -> reasoning -> execution chain stable. | No functional gap; keep regression coverage for pipeline sequencing and trace ordering. | Existing orchestration tests continue to pass with trace order unchanged. |
| Retrieval + reasoning output schema and citation handoff | 95% | Implemented with confidence metadata, reasoning steps, evidence scores, source citations. | Normalize action detail semantics for planner mode (remove outdated tool naming from reasoning metadata). | Reasoning step metadata exposes planner intent only and remains schema compatible. |
| Permission policy rules for HITL decisions | 90% | Native permission gate works; high-risk actions route to approval. | Tighten policy output text so approval means approve plan execution workflow, not external mutation execution. | Approval gating messages are explicit about planner-only mode in backend response metadata. |
| Memory summary and Kairos-lite dedup pass API | 93% | Dedup pass and dedup summary are implemented and tested. | Add optional scheduled dedup trigger policy and persistence strategy note for runtime-ingested docs. | Dedup can run on schedule or explicit trigger; status visible in audit metadata. |
| Core MVP golden flow: IRIS + Confluence end-to-end on main baseline | 92% | Flow is operational and validated in logs (ingest -> chat -> stream -> approval -> transcript), with planner-only completion semantics now implemented. | Add stronger failure-path assertions and policy-focused negative tests. | Golden flow transcript clearly marks planner mode and produces deterministic final plan status. |
| HITL completion path: pending approval -> approve/reject -> audit trace | 90% | Path stores approval decisions, planner-only execution mode, and plan approval/rejection statuses in transcript and response payloads. | Add enriched decision rationale fields and lifecycle event consistency checks. | Approval response includes execution_mode=planner_only and no misleading mutation semantics. |
| Live demo runbook finalization with validated IDs | 76% | Valid IDs are known and used in validation logs. | Consolidate defaults in one canonical config path and document fallback behavior for missing env values. | One canonical runbook for demo defaults; frontend and script flows use same IDs by default. |
| SSE live trace stream and transcript lifecycle | 86% | Trace events, heartbeat, complete/error events are implemented. | Add reconnect-safe and timeout-hardening behavior and include planner-mode annotation in terminal events. | SSE resilience tests pass for reconnect/timeout paths; trace_complete metadata includes planner mode. |
| Ingestion APIs (Confluence, IRIS, GitHub, Jira, Slack) | 88% | Endpoints implemented and benchmarked; partial-failure reporting exists. | Add unified adapter error envelope and retry strategy guidelines for flaky upstreams. | Ingestion responses show consistent error structure; retry behavior documented and tested for one source. |
| Frontend live demo wiring (chat, trace, approval, transcript) | 86% | Core UX implemented and validated in browser, with execution mode surfaced in system and transcript cards. | Render structured execution plan steps and add stronger policy copy in chat/approval UX. | UI never implies external write execution; plan details are visible after approval. |
| Shared contracts for chat, stream, ingestion, approvals, transcript | 95% | Planner-only fields and status enums are now added for approval/transcript/trace metadata. | Add explicit plan object shape guidance for stream payload examples. | Contract and frontend typings compile with new planner fields and all tests pass. |
| Tool execution adapter layer (planner-safe) | 89% | Planner executor now generates plan artifacts with no-write metadata and rollback/precheck steps. | Add deeper intent-specific plan templates and policy tests for mutation-claim prevention. | Any approved action returns plan artifact with explicit no-write metadata and audit step. |
| Verification and benchmark assets | 90% | Benchmarks and E2E API test exist; broad test suite passing in logs. | Add policy tests that fail on mutation-claim wording and fail if execution_mode is missing. | Policy tests pass; no runtime payload claims external write completion. |
| Documentation consistency (TO-DO and handoff docs) | 65% | Status evidence exists but some sections remain stale or contradictory. | Reconcile In Progress vs Verification Log and align docs to planner-only semantics. | TO-DO and working docs contain no contradictions on completion and policy. |

## 4. Summary Completion

- Weighted overall completion: 89%
- Primary remaining work: reliability hardening, richer plan templates in UI, and documentation consistency updates.

## 5. Vertical Slice Build Plan

## Slice 1: Planner-Only Execution Semantics (Highest Priority)

Goal: make runtime truthfully planner-only for external actions.

Implementation:

1. Introduce execution_mode in execution, approval, and transcript payloads with value planner_only.
2. Replace ambiguous statuses (executed for external writes) with plan_generated, plan_approved, plan_rejected.
3. Ensure execution output is a plan artifact (steps, dependencies, risks, rollback notes).

Target files:

- backend/src/swarms/execution_swarm.py
- backend/app/api/routes/approvals.py
- backend/src/tools/executor.py
- shared/contracts/chat.contract.json
- frontend/lib/chat-api.ts

Definition of done:

- No external-action response implies external mutation occurred.
- Approval response and transcript clearly represent plan state only.

## Slice 2: HITL and Audit Clarity

Goal: make approval decisions auditable and operator-friendly.

Implementation:

1. Persist decision rationale and approver comment as first-class transcript fields.
2. Add explicit audit markers for plan approval lifecycle transitions.
3. Standardize approval event metadata between stream and transcript.

Target files:

- backend/src/memory/three_tier_memory.py
- backend/app/api/routes/chat.py
- backend/app/api/routes/approvals.py

Definition of done:

- Audit trail can reconstruct full decision timeline without ambiguity.

## Slice 3: Frontend Transparency and Operator UX

Goal: remove any confusion between plan and execution.

Implementation:

1. Add planner-only banner and execution policy note in UI.
2. Render generated plan steps after reasoning and after approval.
3. Show plan_status and execution_mode in transcript panel.

Target files:

- frontend/app/page.tsx
- frontend/lib/chat-api.ts

Definition of done:

- Demo user can clearly tell that approved actions generate an execution plan only.

## Slice 4: Reliability and Integration Hardening

Goal: improve runtime resilience for demo and development.

Implementation:

1. Add SSE reconnect and timeout behavior tests.
2. Add unified adapter error envelope for ingestion endpoints.
3. Reduce read-after-write race risk for transcript fetch with explicit readiness metadata.

Target files:

- backend/app/api/routes/chat.py
- backend/app/api/routes/ingestion.py
- backend/tests/test_chat_stream.py
- backend/tests/test_e2e_ingest_chat_approve.py

Definition of done:

- Stream and transcript lifecycle remains stable under interruption and delayed writes.

## Slice 5: Documentation and Verification Closure

Goal: align operational documents to actual behavior.

Implementation:

1. Update TO-DO In Progress section to match verified completion state.
2. Align implementation status docs with planner-only terminology.
3. Add a policy verification checklist to release/demo runbook.

Target files:

- TO-DO.md
- docs/ways-of-working/IMPLEMENTATION_STATUS_2026-04-16.md
- docs/ways-of-working/HANDOFF_2026-04-16.md

Definition of done:

- No status contradiction remains across tracking docs.

## 6. Implementation Backlog Derived from TO-DO Features

Priority P0:

1. Planner-only status and contract normalization (Slice 1).
2. HITL audit semantic hardening (Slice 2).
3. Frontend planner-only transparency (Slice 3).

Priority P1:

1. SSE and adapter reliability hardening (Slice 4).
2. Demo runbook/default ID canonicalization and docs sync (Slice 5).

Priority P2:

1. Optional dedup scheduling policy.
2. Extended policy conformance tests and benchmark scenarios.

## 7. Build Start Checklist

Before implementation starts:

1. Confirm status vocabulary for planner-only mode.
2. Confirm contract fields to be added in shared schema.
3. Confirm frontend UX copy for no-write policy.
4. Confirm P0 slice order and owners.

When all four are confirmed, implementation can begin with Slice 1.
