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

## Notes

- Route prefixes currently follow the project router layout (no /api/v1 prefix).
- Contracts are intentionally demo-oriented and deterministic for hackathon reliability.
