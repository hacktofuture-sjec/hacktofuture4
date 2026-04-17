# API Endpoints (Implemented Contracts)

## Purpose

This document describes the currently implemented backend API contracts relevant to the agent loop.

## Agent Orchestration Routes

### POST /monitor

Collects monitor snapshot and returns normalized monitor payload.

### POST /diagnose

Runs diagnosis on provided snapshot (or collected snapshot if omitted).

### POST /plan

Runs planner from provided diagnosis/context (or from fresh diagnose path).

### POST /pipeline

Executes the monitor -> diagnose -> plan pipeline in one call.

## Incident Lifecycle Routes

### GET /incidents

Returns in-memory incident list for demo flow.

### GET /incidents/{incident_id}

Returns incident detail record.

### POST /incidents/{incident_id}/plan

Generates planner output and persists:

- diagnosis snapshot
- plan actions (JSON-safe)
- planner context summary

Sets incident status:

- pending_approval if any action requires approval
- otherwise planned

### POST /incidents/{incident_id}/simulate

Re-runs simulation for a planned action index and updates persisted simulation_result.

Validation:

- 400 when action_index is invalid or plan is missing

### POST /incidents/{incident_id}/approve

Marks incident as approved for execution stage.

Validation:

- 400 if status is not planned or pending_approval

Status transition:

- planned|pending_approval -> approved

### POST /incidents/{incident_id}/execute

Executes selected approved action through executor agent.

Validation:

- 400 if incident is not approved
- 400 if plan/actions are missing

Status transitions:

- approved -> executing -> verifying on success
- approved -> executing -> failed when command is blocked or execution fails

### POST /incidents/{incident_id}/verify

Runs threshold-based recovery verification and closes incident.

Validation:

- 400 if incident is not in verifying
- 400 if window_seconds is invalid or non-positive
- 400 if metric percentage inputs are invalid

Status transitions:

- verifying -> resolved when thresholds pass
- verifying -> failed when thresholds fail

## Cost Route

### GET /cost-report

Returns token/cost counters from the global token governor:

- estimated/actual cost
- call count
- estimated/actual token totals

## Execute Details

### POST /incidents/{incident_id}/execute (Expanded)

Executes selected approved action through executor agent in vCluster sandbox.

**Request body** (optional):

```json
{
  "action_index": 0 // Default: 0. Must be valid integer within plan actions.
}
```

Execution flow:

1. Validate incident is in `approved` status
2. Create vCluster sandbox
3. Validate command against allowlist (safe kubectl operations only)
4. Run action in sandbox
5. Promote if successful

Allowlisted commands:

- `kubectl rollout restart`
- `kubectl scale deployment`
- `kubectl set resources`
- `kubectl patch pod`

Validation:

- 400 if incident is not in `approved` status
- 400 if plan/actions are missing
- 400 if `action_index` is invalid or out of range
- 400 if command is not in allowlist

Status transitions:

- `approved -> executing -> verifying` on successful execution
- `approved -> executing -> failed` when command is blocked or execution fails

### POST /incidents/{incident_id}/verify (Expanded)

**Request body**:

```json
{
  "window_seconds": 120, // Required: positive integer
  "metrics": {
    // Optional but recommended
    "memory": "55%", // Must be valid percentage (0-100, finite)
    "cpu": "40%" // Can also use memory_pct, cpu_pct keys
  }
}
```

Threshold checks (recovered when ALL pass):

- Memory < 90%
- CPU < 85%
- Restarts stable (no new restarts in window)
- Error rate < 5%
- Latency p95 < 1.5s

## Notes

- Route prefixes currently follow the project router layout (no /api/v1 prefix).
- All percent values are floored (not rounded) to preserve threshold semantics (e.g., 89.6% -> 89% stays below 90% limit).
- Contracts are intentionally demo-oriented and deterministic for hackathon reliability.
