# Frontend PR Review Todo

Source: Copilot + CodeRabbit review comments on PR #2.

## High-priority fixes
- [x] Remove `package-lock.json` from ignore list.
- [x] Replace empty `.page {}` rule with real style.
- [x] Stabilize WebSocket handler (`useRef`) to avoid reconnect churn.
- [x] Prevent reconnect timer from running after unmount.
- [x] Log malformed WebSocket payload errors.
- [x] Add error-safe handling around async action buttons:
  - [x] `ApprovalModal.submit`
  - [x] `DiagnosisPanel` run action
  - [x] `PlannerPanel` generate action
  - [x] `ExecutorPanel` run action
  - [x] `VerifierPanel` run action
- [x] Add explicit error handling for `FaultInjector` load/inject.
- [x] Add explicit error handling for `useIncidents` polling.
- [x] Add stale-request guards + error handling:
  - [x] `IncidentDrawer` detail fetch
  - [x] `TimelinePanel`
  - [x] `TokenCostPanel`
- [x] Improve accessibility:
  - [x] `ProgressBar` ARIA semantics
  - [x] `Spinner` status semantics
  - [x] `IncidentCard` keyboard support for `Space`
  - [x] `ApprovalModal` dialog labeling
  - [x] `IncidentDrawer` dialog labeling
- [x] Fix `URLSearchParams` undefined serialization in `api.listIncidents`.
- [x] Avoid forcing `Content-Type` on all requests (preflight risk).
- [x] Harden `formatDistanceToNow` for invalid/future timestamps.

## Contract mismatch notes (defer)
- [ ] Backend endpoint/path mismatches reported by reviewers.
- [ ] Backend response-shape mismatches (`healthz`, `incidents`, `cost-report`).

> Defer these contract issues for backend alignment because frontend implementation currently follows the provided frontend docs contract.
