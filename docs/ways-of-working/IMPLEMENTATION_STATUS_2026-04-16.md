# UniOps Implementation Status (Updated 2026-04-17)

This document captures the as-built state after Slice 4 reliability hardening and Slice 5 documentation cleanup.

## 0) Current Project Status Snapshot

Legend:
- [x] Completed for now
- [~] In progress / partial
- [ ] Pending

Status:
- [x] Backend APIs and approval flow
- [x] Frontend integration completeness for chat, trace timeline, ingestion, and approval actions
- [x] SSE completion with reconnect-safe behavior, heartbeat events, and idle timeout termination
- [x] Ingestion error envelope consistency across endpoint-level and per-item failures
- [x] Transcript readiness hardening (atomic writes + wait-based reads)
- [x] Groq-first backend rollout across retrieval, reasoning, and execution swarms

## 1) What Is Implemented End-to-End

### Backend API
- Health endpoint:
  - `GET /health`
- Chat and trace endpoints:
  - `POST /api/chat` (live SSE execution stream)
  - `GET /api/chat/transcript/{trace_id}`
- Ingestion endpoints:
  - `POST /api/ingest/iris?case_id=<id>`
  - `POST /api/ingest/confluence` with body `{ "page_ids": ["..."] }`
  - `POST /api/ingest/github`
  - `POST /api/ingest/jira`
  - `POST /api/ingest/slack/channels`
  - `POST /api/ingest/slack/threads`
- Vector endpoints:
  - `GET /api/vector/status`
  - `POST /api/vector/rebuild`
- Approval endpoint:
  - `POST /api/approvals/{trace_id}`

### Core Runtime Flow
1. Query enters Controller Kernel.
2. Retrieval swarm performs keyword plus optional hybrid retrieval, with Groq-assisted query expansion when provider is enabled.
3. Reasoning swarm prioritizes evidence, computes confidence and reasoning breakdown metadata, and proposes structured action details.
4. Execution swarm performs Groq-based action normalization/risk rationale (when enabled), then classifies risk with native permission gate.
5. If high or uncertain risk, status is `pending_approval`.
6. Approval API applies `approve` or `reject` decision.
7. Transcript and audit artifacts are updated with final outcome (`plan_approved` or `plan_rejected`) under planner-only execution policy.

### Memory and Audit
- Three-tier memory currently supports:
  - Static source loading from `data/{confluence,runbooks,incidents,github,slack}`
  - Runtime ingestion merge for IRIS/Confluence/GitHub/Jira/Slack docs
  - Dedup pass and summary metadata
  - Transcript persistence with action details and approval status fields
  - Atomic JSON persistence for transcript and approval artifacts
  - Wait-based transcript reads to reduce read-after-write races
  - Approval audit persistence under `backend/.uniops/approvals/`

### SSE Status
- SSE now runs as a live execution stream on `POST /api/chat`.
- Stream lifecycle events implemented: `trace_started`, `trace_step`, `trace_heartbeat`, `trace_complete`, and `trace_error`.
- Event envelopes include ordered sequencing and observability context: `event_id`, `trace_id`, `sequence`, and `status`.
- Step metadata now includes timing fields (`started_at`, `finished_at`, `duration_ms`) in addition to reasoning/execution metadata.
- Stream hardening includes bounded queue handling, disconnect stop signaling, idle timeout termination (`stream_timeout`), malformed-event guard (`invalid_stream_event`), and explicit SSE anti-buffering headers.

## 2) Key Files Added/Updated

### API routes
- `backend/app/api/routes/chat.py`
- `backend/app/api/routes/ingestion.py`
- `backend/app/api/routes/approvals.py`
- `backend/app/main.py`

### Core orchestration and memory
- `backend/src/agents/orchestrator.py`
- `backend/src/controller/controller.py`
- `backend/src/swarms/retrieval_swarm.py`
- `backend/src/swarms/reasoning_swarm.py`
- `backend/src/swarms/execution_swarm.py`
- `backend/src/memory/three_tier_memory.py`
- `backend/src/gates/permission_gate.py`
- `backend/src/vector_store/llamaindex_hybrid.py`
- `backend/src/adapters/llm_client.py`

### Integrations and tools
- `backend/src/adapters/iris_client.py`
- `backend/src/adapters/confluence_client.py`
- `backend/src/tools/executor.py`
- `backend/src/tools/registry.py`

### Contract
- `shared/contracts/chat.contract.json`

### Local DFIR-IRIS setup
- `Makefile` targets for IRIS lifecycle:
  - `iris-install`, `iris-up`, `iris-down`, `iris-logs`, `iris-admin-password`
- `scripts/iris/install_iris_web.sh`
- `docs/ways-of-working/LOCAL_DFIR_IRIS_SETUP_MACOS.md`
- `docs/ways-of-working/IRIS_INCIDENT_SETUP.md`

## 3) Current Contract Highlights

### Chat request modes
- `message_only`
- `incident_report_only`
- `message_and_incident_report`

Rule: when `incident_report` is present, backend derives canonical query context from that report.

### Chat response
- Live SSE event stream from `POST /api/chat`
- Terminal `trace_complete` event carries `answer`, `needs_approval`, `trace_id`, and dedup summary in metadata

### Provider error behavior
- `POST /api/chat` emits terminal `trace_error` SSE events for selected provider misconfiguration/runtime failure.

### Transcript metadata (implemented)
- `suggested_action`
- `action_details`
- `needs_approval`
- `execution_status`
- Optional after approval:
  - `approval`
  - `execution_result`
  - `final_status`

### Trace and stream metadata (implemented)
- `retrieval_method`, `query_tokens`, `llm_query_expansion`
- `confidence`, `confidence_breakdown`, `reasoning_steps`, `evidence_scores`
- `risk_level`, `requires_human_approval`, `execution_reasoning`, `risk_hint`

### Approval API response (implemented)
- `trace_id`
- `final_status` (`plan_approved` or `plan_rejected`)
- `approval` object
- `execution_result` object

### Ingestion contract (implemented)
- Request body:
  - source-specific IDs/refs (deduplicated, non-empty)
- Response:
  - `ingested_count`
  - `failed_count`
  - `source`
  - `results[]` with per-item `status`, optional `error`, and structured `error_detail` envelope (`code`, `message`, `source`, `stage`, `retriable`, `target`)

## 4) Test and Verification Evidence

### Confirmed passing in current environment
- Reliability-focused regression suite:
  - `tests/test_chat_orchestration.py`
  - `tests/test_chat_iris_input.py`
  - `tests/test_chat_stream.py`
  - `tests/test_approvals.py`
  - `tests/test_ingestion.py`
  - `tests/test_memory_dedup.py`
  - Result: `36 passed`
- Additional post-merge full backend run on 2026-04-17:
  - `backend/.venv/bin/python -m pytest -q`
  - Result: `52 passed`

### Frontend validation
- `frontend npm run build`
  - Result: success (Next.js production build complete)

### Additional implemented test files
- `backend/tests/test_chat_iris_input.py`
- `backend/tests/test_chat_orchestration.py`
- `backend/tests/test_chat_stream.py`
- `backend/tests/test_ingestion.py`
- `backend/tests/test_memory_dedup.py`
- `backend/tests/test_reasoning_tuning.py`
- `backend/tests/test_retrieval_execution_groq.py`
- `backend/tests/test_e2e_ingest_chat_approve.py`

### Manual E2E verification script
- `scripts/e2e_confluence_flow.sh`
  - Sequence: ingest Confluence pages -> chat -> stream -> approval -> transcript
  - Required env: `CONFLUENCE_PAGE_IDS`

### Docs and schema availability
- Swagger UI active at `http://127.0.0.1:8000/docs`
- OpenAPI JSON active at `http://127.0.0.1:8000/openapi.json`

## 5) Frontend Status

### Implemented
- Next.js interactive UI in `frontend/app/page.tsx` and `frontend/app/globals.css`
- Backend API utility and SSE event parsing in `frontend/lib/chat-api.ts`
- Trace timeline rendering for real streamed events and metadata
- Ingestion controls for supported sources and transcript refresh flow
- Approval interaction wiring for planner-only decision flow

## 6) Known Gaps (Next Work Items)

1. Keep external execution policy planner-only until explicit approval for real write operations is granted.
2. Add adapter retry/backoff policy tuning for flaky provider network conditions.
3. Add optional scheduled sync mode (currently manual ingestion trigger only).
4. Runtime-ingested documents are intentionally non-persistent for this slice and must be re-ingested after restart.
