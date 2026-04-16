# Agents Implementation Overview (Current State)

## Scope Summary

This project implements a complete, multi-agent incident-response loop with monitoring, diagnosis, planning, execution, and verification.

**All 4 phases now implemented and integrated:**

- Phase 1: Rule-first diagnosis with fingerprint matching
- Phase 2: LLM fallback diagnosis with token/cost governance
- Phase 3: Monitor -> diagnose -> plan orchestration endpoints
- Phase 4: ✅ Complete — Incident execution in sandbox, threshold-based recovery verification, full lifecycle closure

## What Is Implemented

### Monitor Agent

- Collects metrics (Prometheus), logs (Loki), K8s events, and traces (Tempo)
- Filters and correlates four telemetry pillars into compact incident snapshots
- Top-5 log signatures, 10-min event window, metric summaries

### Diagnose Agent

- Rule catalog for known failures (5+ fingerprints with confidence scoring)
- Feature extraction and confidence-aware decision flow
- Conditional LLM fallback with graceful degradation and JSON parsing guardrails
- Outputs root-cause diagnosis with evidence trace

### Planner Agent

- Policy-based action ranking with risk levels (low/medium/high)
- Plan simulator: blast radius, dependency impact, rollback feasibility
- Deterministic action selection based on incident fingerprint

### Executor Agent

- Command allowlist validation (safe kubectl operations only)
- Sandbox-first executor flow: create vCluster → validate → promote
- Deterministic demo implementation for hackathon reliability

### Verifier Agent

- Threshold-based recovery validation against 5 metrics (memory%, CPU%, restarts, error rate, latency p95)
- Automatic incident closure when thresholds pass
- Escalation to failed when recovery does not stabilize

### Full Incident Lifecycle Endpoints

| Route                         | Phase           | What It Does                        |
| ----------------------------- | --------------- | ----------------------------------- |
| POST /incidents/{id}/plan     | Diagnose → Plan | Generate ranked actions             |
| POST /incidents/{id}/simulate | Plan            | Recompute blast radius for action   |
| POST /incidents/{id}/approve  | Approval        | Operator gate for high-risk actions |
| POST /incidents/{id}/execute  | Executor        | Run action in sandbox → promote     |
| POST /incidents/{id}/verify   | Verifier        | Check recovery → close or fail      |

Status transitions:

`open → diagnosing → planned → pending_approval → approved → executing → verifying → resolved|failed`

## Test Status

- ✅ **60 backend tests passing** (all phases integrated)
- Route-level coverage:
  - Monitor/diagnose/plan orchestration (happy path + error handling)
  - Plan/simulate/approve flow with state validation
  - Execute/verify transitions with command allowlist blocking
  - Threshold boundary preservation (verifier floors percents, not rounds)
  - Edge cases: non-finite percentages, missing metric keys, non-positive windows
  - State isolation per test via fixture (no cross-test contamination)

## Known Limitations

- **Executor and verifier** use deterministic simulation mode for hackathon safety (not real rollout observers yet).
- **Monitor collectors** are partially stubbed:
  - Loki queries return empty (real LogQL queries not yet integrated)
  - Prometheus direct queries available but mocked data in demo
  - K8s events and Tempo working but with synthetic data
- **Incident storage** is in-memory only (no durable SQLite persistence yet).
- **LLM integration** is framework-ready but requires OPENAI_API_KEY environment variable.

## Next Continuation Priorities

### Phase 5: Signal Intelligence & Real Collectors (Kushal)

1. Integrate real Loki queries for log filtering
2. Implement Prometheus remote query with real metrics
3. Add K8s event polling with actual cluster events
4. Tempo trace summary extraction from real spans

### Phase 6: Frontend Dashboard Integration (Vivek)

1. WebSocket streaming of incident events
2. Agent trace visualization (Monitor → Diagnose → Planner → Executor)
3. Live action approval modal with risk display
4. Recovery timeline and closure report
5. Inject Fault control for deterministic demo scenarios

### Phase 7: Production Hardening (Aravind + Rajatha)

1. Durable incident timeline in SQLite
2. Real vCluster sandbox integration with live rollout observers
3. Rollback hook validation before execution
4. Operator metadata in approval flow (operator_id, operator_note)
5. Full audit trail per incident lifecycle
