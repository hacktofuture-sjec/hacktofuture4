# UniOps Implementation Tracker

## Branch Lane Map
- Engineer 1 core branch: `feature/backend-orchestration-and-skills` (this branch)
- Engineer 2 systems branch: `feat/backend-systems-queue-flow`
- Shared contract branch: `chore/shared-actions-contract`

## Engineer 1 Full Plan (Target 10 points)
- [x] P0 (3): Controller pipeline with swarm chaining.
- [x] P0 (3): Retrieval + reasoning output schema and citation handoff.
- [x] P1 (2): Permission policy rules for HITL decisions.
- [ ] P1 (2): Memory summary and Kairos-lite dedup pass API.
- Current completion: 8/10 points.
- Remaining completion: 2/10 points.

## Backlog
- [ ] Engineer 1: Add `run_dedup_pass()` in `backend/src/memory/three_tier_memory.py` for transcript/doc dedup.
- [ ] Engineer 1: Expose dedup summary metadata in memory summary API shape.
- [ ] Engineer 1: Add focused tests for dedup behavior and deterministic idempotency.
- [ ] Engineer 1: Tune reasoning quality hints for source prioritization (non-breaking).

## In Progress
- [ ] Engineer 1 lane lock: avoid systems files (`backend/app/**`, `backend/src/gates/approval_queue.py`, `backend/src/gates/executor.py`, `backend/tests/**` except core tests).

## Done
- [x] Established branch split strategy and pushed baseline/core changes to `main`.
- [x] Pushed backend orchestration and skill assets to feature branch.
- [x] Slice 1: Contract updates for stream/transcript endpoints.
- [x] Slice 1: Backend SSE trace stream endpoint (`GET /api/chat/stream`).
- [x] Slice 1: Backend transcript read endpoint (`GET /api/chat/transcript/{trace_id}`).
- [x] Slice 1: Frontend hooks for chat and trace streaming.
- [x] Slice 1: Frontend page integration for answer + live trace.
- [x] Slice 1: Backend tests for stream and transcript behavior.
- [x] Systems-slice changes moved off this branch to `feat/backend-systems-queue-flow`.
- [x] Shared contract actions changes moved to `chore/shared-actions-contract`.

## Risks
- SSE consumers can see parse errors if event payload shape changes unexpectedly.
- Browser CORS can block frontend-to-backend calls if origin config is too strict.
- Read-after-write race is possible if transcript fetch occurs before file write completion.
- Engineer 1 delivery risk: Kairos-lite dedup remains incomplete and is the only missing allocated feature.

## Decisions
- Tight Slice 1 first: TO-DO + SSE trace + transcript read + frontend live trace.
- Queue work is now isolated to systems branch (`feat/backend-systems-queue-flow`).
- Shared actions contract is isolated to `chore/shared-actions-contract`.
- Keep `POST /api/chat` response backward compatible.

## Verification Log
- 2026-04-16: Started Slice 1 implementation.
- 2026-04-16: Backend tests passed (`pytest -q`): 6 passed.
- 2026-04-16: Frontend production build passed (`npm run build`).
- 2026-04-16: Slice 1 marked complete; queue work remains in Backlog for Slice 2.
- 2026-04-16: Stream test suite cleaned and rerun (`pytest -q`): 7 passed.
- 2026-04-16: Branch split completed; systems and shared changes removed from Engineer 1 branch.
