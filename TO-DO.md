# UniOps Implementation Tracker

## Backlog
- [ ] Slice 2: Add approval queue persistence module (`backend/src/gates/approval_queue.py`).
- [ ] Slice 2: Add approve/reject APIs and executor wiring.
- [ ] Slice 2: Add frontend approval actions and queue panel.

## In Progress
- [ ] Slice 2 prep: define queue API contract additions before implementation.

## Done
- [x] Established branch split strategy and pushed baseline/core changes to `main`.
- [x] Pushed backend orchestration and skill assets to feature branch.
- [x] Slice 1: Contract updates for stream/transcript endpoints.
- [x] Slice 1: Backend SSE trace stream endpoint (`GET /api/chat/stream`).
- [x] Slice 1: Backend transcript read endpoint (`GET /api/chat/transcript/{trace_id}`).
- [x] Slice 1: Frontend hooks for chat and trace streaming.
- [x] Slice 1: Frontend page integration for answer + live trace.
- [x] Slice 1: Backend tests for stream and transcript behavior.

## Risks
- SSE consumers can see parse errors if event payload shape changes unexpectedly.
- Browser CORS can block frontend-to-backend calls if origin config is too strict.
- Read-after-write race is possible if transcript fetch occurs before file write completion.

## Decisions
- Tight Slice 1 first: TO-DO + SSE trace + transcript read + frontend live trace.
- Queue work is deferred to Slice 2.
- Keep `POST /api/chat` response backward compatible.

## Verification Log
- 2026-04-16: Started Slice 1 implementation.
- 2026-04-16: Backend tests passed (`pytest -q`): 6 passed.
- 2026-04-16: Frontend production build passed (`npm run build`).
- 2026-04-16: Slice 1 marked complete; queue work remains in Backlog for Slice 2.
- 2026-04-16: Stream test suite cleaned and rerun (`pytest -q`): 7 passed.
