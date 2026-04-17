# IncidentAssembler Implementation

## Overview

The **IncidentAssembler** is the primary entry point for normalizing 4-signal observations (metrics, logs, traces, Kubernetes events) into production-ready IncidentSnapshot JSON following the Monitor Agent specification from [docs/reference/06-monitor-agent-implementation.md](../../../hacktofuture_docs/docs/reference/06-monitor-agent-implementation.md).

## Architecture

```
4 Parallel Signal Collectors
├── PrometheusCollector (metrics)
├── LokiCollector (logs)
├── TempoCollector (traces)
└── K8sEventsCollector (events)
        ↓
   IncidentAssembler
      │
      ├─ Validate & time-window filter [started_at - 2m, started_at + 5m]
      ├─ Normalize metrics → feature vectors
      ├─ Summarize logs → deduped signatures  
      ├─ Summarize traces → span latency stats
      ├─ Classify failure via rule map
      ├─ Compute monitor_confidence via multi-signal correlation
      └─ Output: Single normalized IncidentSnapshot JSON
        ↓
   SnapshotBuilder (convert to Pydantic model)
        ↓
   Downstream: Diagnose Agent → Planner → Executor
```

## File Structure

```
backend/
├── incident/
│   ├── incident_assembler.py       ← NEW: 4-signal normalizer (450 lines)
│   ├── snapshot_builder.py         ← EXISTING: Pydantic model builder
│   └── __init__.py
├── fault_injection/
│   ├── fault_injector.py           ← MODIFIED: Uses IncidentAssembler in collect_snapshot()
│   └── __init__.py
└── tests/
    └── test_incident_assembler_demo.py  ← NEW: Full demos (3 scenarios)
```

## Core API

### `IncidentAssembler.assemble()`

**Signature:**
```python
IncidentAssembler.assemble(
    injection_event: dict[str, Any],
    collected_signals: dict[str, Any],
    context: Optional[dict[str, Any]] = None,
) -> dict[str, Any]
```

**Inputs:**

1. **injection_event** (dict):
   - `scenario_id`: str (e.g., "oom-kill-001")
   - `service`: str (e.g., "payment-api")
   - `namespace`: str (e.g., "prod")
   - `pod`: str (e.g., "payment-api-6f5d")
   - `deployment`: str (e.g., "payment-api")
   - `started_at`: ISO8601 timestamp

2. **collected_signals** (dict):
   - `metrics`: dict with keys: memory_usage_percent, cpu_usage_percent, restart_count, latency_p95_seconds, error_rate_rps
   - `logs`: list[str] (raw log lines, filtered by severity)
   - `traces`: list[dict] (OTLP trace spans; can be empty)
   - `events`: list[dict] (Kubernetes events with reason, message, timestamps)

3. **context** (dict, optional):
   - `baseline_values`: dict for anomaly Z-score normalization
   - `dependency_graph_summary`: str (Service dependency chain for context)

**Output:**

Single normalized **IncidentSnapshot JSON** with structure:

```json
{
  "incident_id": "inc-a1b2c3d4",
  "scenario_id": "oom-kill-001",
  "service": "payment-api",
  "namespace": "prod",
  "severity": "high",
  "started_at": "2026-04-16T01:00:00Z",
  "snapshot": {
    "alert": "resource_exhaustion detected on payment-api",
    "pod": "payment-api-6f5d",
    "metrics": {
      "cpu": "45%",
      "memory": "95%",
      "restarts": 2,
      "latency_delta": "1.2x"
    },
    "events": [
      {
        "reason": "OOMKilled",
        "message": "...",
        "count": 1,
        "first_seen": "...",
        "last_seen": "...",
        "pod": "payment-api-6f5d",
        "namespace": "prod",
        "type": "Warning"
      }
    ],
    "logs_summary": [
      { "signature": "memory cgroup <id>: OOMKilled process <N>", "count": 2 },
      { "signature": "failure to allocate memory", "count": 1 }
    ],
    "trace_summary": {
      "enabled": true,
      "suspected_path": "payment-api -> postgresql",
      "hot_span": "db.query",
      "p95_ms": 2300
    },
    "scope": {
      "namespace": "prod",
      "deployment": "payment-api"
    },
    "monitor_confidence": 0.92,
    "failure_class": "resource_exhaustion",
    "dependency_graph_summary": "frontend -> payment-api -> postgresql"
  }
}
```

## Processing Steps

### 1. Validation & Defaults
- Validates all input fields (null-safe defaults)
- Auto-generates incident_id if missing
- Sets time windows: [started_at - 2m, started_at + 5m]

### 2. Signal Filtering
- Filters events, logs, traces by:
  - Scope: namespace, service, pod, deployment
  - Time window: incident ± buffer
- Discards out-of-scope telemetry

### 3. Log Summarization
- Normalizes log messages (replaces IDs, timestamps, IPs, numbers with `<id>`, `<ts>`, `<ip>`, `<N>`)
- Deduplicates similar messages via Counter
- Returns top N signatures with counts (default N=5)

### 4. Trace Summarization
- Extracts all spans from OTLP trace format
- Computes p95 latency (milliseconds)
- Identifies "hot span" (most frequent operation name)
- Returns null if no traces available

### 5. Metric Normalization
- Maps raw metric keys to standard keys: memory_usage_percent, cpu_usage_percent, restart_count, etc.
- Handles both prefixed forms (e.g., memory_pct, memory_usage_percent)
- Computes metric feature vector (anomaly flags, severity levels)

### 6. Failure Classification (Rule-Based)
Routes through classification rules in order:
```
OOMKilled or Evicted or memory_anomaly  → resource_exhaustion
CrashLoopBackOff + restart_burst        → application_crash
ImagePullBackOff or ErrImagePull        → config_error
FailedScheduling                        → infra_saturation
latency_anomaly + (timeout|connection)  → dependency_failure
cpu_anomaly                             → resource_exhaustion
(default)                               → unknown
```

### 7. Confidence Computation
Multi-signal scoring (0.0-1.0):
```
Base:
  - critical metric severity    → +0.50
  - warn metric severity        → +0.30

Bonus:
  - metric anomaly detected     → +0.10
  - restart burst detected      → +0.10
  - 2+ K8s high-signal events   → +0.20
  - 1 K8s high-signal event     → +0.12
  - 3+ log signatures           → +0.10
  - 1+ log signature            → +0.05
  - trace present               → +0.05

Clamped: [0.0, 1.0]
```

### 8. Severity Inference
```
confidence > 0.8  → "high"
confidence > 0.5  → "medium"
(default)         → "low"
```

## Thresholds (from spec)

```python
THRESHOLDS = {
    "memory_usage_percent":   {"warn": 85, "critical": 95},
    "cpu_usage_percent":      {"warn": 80, "critical": 95},
    "restart_count_5m":       {"warn": 3,  "critical": 7},
    "error_rate_rps":         {"warn": 5,  "critical": 20},
    "latency_p95_seconds":    {"warn": 1.5,"critical": 3.0},
}
```

## Integration Points

### FaultInjector.collect_snapshot()
When a fault is injected:
1. Wait for fault to settle
2. Collect all 4 signals in parallel
3. Call `IncidentAssembler.assemble()` to normalize
4. Convert output to IncidentSnapshot Pydantic model
5. Return to client/downstream agent

**Before:**
```python
# Old code: manual assembly with heuristic confidence
monitor_confidence = 0.45
if features.get("memory_anomaly"):
    monitor_confidence += 0.2
...
```

**After:**
```python
# New code: comprehensive 4-signal correlation
incident_dict = IncidentAssembler.assemble(
    injection_event={...},
    collected_signals={...},
    context={...}
)
snapshot = SnapshotBuilder.build(...incident_dict["snapshot"]...)
```

## Testing

### Demo Suite
[backend/tests/test_incident_assembler_demo.py](backend/tests/test_incident_assembler_demo.py)

**Scenarios:**
1. **OOMKilled**: High memory (95%) + OOMKilled event + memory logs → resource_exhaustion, high confidence (0.9)
2. **CPU Spike**: High CPU (92.5%) + latency spike (2.3x) + timeout logs + traces → dependency_failure, medium confidence (0.67)
3. **Config Error**: ImagePullBackOff events, no metrics anomaly → config_error, low confidence (0.2)

**Run:**
```bash
cd backend
python tests/test_incident_assembler_demo.py
# Output: ✓ All IncidentAssembler demos passed!
```

## Validation Rules

### Evidence of Successful Implementation

1. ✓ All 4 signals collected and filtered by scope + time
2. ✓ Logs normalized and deduplicated into signatures
3. ✓ Traces summarized or null if unavailable
4. ✓ Metrics compared to baseline for anomaly detection
5. ✓ Failure class correctly matched from rule map
6. ✓ Monitor confidence computed via multi-signal correlation
7. ✓ Output JSON conforms to IncidentSnapshot schema
8. ✓ 3 demo scenarios pass with realistic outputs

## Next Steps

1. **Deploy to live system**: Update production fault_injector to use IncidentAssembler
2. **Monitor Agent integration**: Replace stub MonitorAgent.collect_snapshot() with real polling + IncidentAssembler
3. **Dashboard updates**: Wire IncidentSnapshot → Grafana panel for confidence/failure_class display
4. **Thresholds tuning**: Adjust confidence weights based on incident audit feedback
5. **Trace parsing**: Enhance OTLP trace parsing for complex multi-service flows

## References

- Spec: [docs/reference/06-monitor-agent-implementation.md](../../../hacktofuture_docs/docs/reference/06-monitor-agent-implementation.md)
- Models: [backend/models/schemas.py](../models/schemas.py) (IncidentSnapshot, MetricSummary, etc.)
- Fault Injector: [backend/fault_injection/fault_injector.py](../fault_injection/fault_injector.py)
