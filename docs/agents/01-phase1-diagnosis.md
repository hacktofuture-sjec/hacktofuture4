# Phase 1: Rule-Based Diagnosis Implementation

## Purpose

Phase 1 implements the deterministic, rule-based diagnosis path. It matches incident snapshots against a catalog of 5 hardcoded fingerprints (low-risk infrastructure failures) and extracts 13 features for confidence scoring and fallback decisions.

**Key characteristic**: Fast (< 100ms), fully explainable, no AI calls required.

---

## Component Position

```
IncidentSnapshot (metrics, events, logs, context)
        ↓
    ┌─────────────────────────────────────────────────┐
    │        Rule-Based Diagnosis Engine               │
    │ Stage 1: Fingerprint Matching (5 patterns)      │
    │ Stage 2: Feature Extraction (13 signals)        │
    └─────────────────────────────────────────────────┘
        ↓ (if confidence >= 75%, skip AI)
    DiagnosisPayload {root_cause, confidence, actions}
        ↓
    Planner Agent
```

---

## File Reference

**Implementation**: `backend/diagnosis/rule_engine.py` (~180 lines)  
**Feature Extraction**: `backend/diagnosis/feature_extractor.py` (~210 lines)  
**Tests**: `backend/tests/test_diagnosis_agents.py` (9 tests)

---

## Stage 1: Fingerprint Catalog (5 Patterns)

Each fingerprint is a rule with conditions, root cause, affected services, and confidence score.

### FP-001: Memory Exhaustion (OOMKilled)

```python
{
    "id": "FP-001",
    "name": "memory_exhaustion_oom",
    "conditions": [
        lambda s: any(e["reason"] == "OOMKilled" for e in s.events),
        lambda s: int(s.metrics["memory_pct"]) >= 90,
    ],
    "root_cause": "memory exhaustion: container exceeded memory limit",
    "affected_services": lambda s: [s.service],
    "confidence": 0.95,
    "recommended_fix": "increase memory limit or restart pod to clear state",
}
```

**Matching logic**: Both conditions must be true (AND).  
**Confidence**: 0.95 (very high — OOMKilled event + high memory % is definitive).  
**What it detects**: Pods being killed by kernel OOM killer due to memory pressure.

---

### FP-002: Crash Loop (CrashLoopBackOff)

```python
{
    "id": "FP-002",
    "name": "crash_loop_application_error",
    "conditions": [
        lambda s: any(e["reason"] in {"CrashLoopBackOff", "BackOff"} for e in s.events),
        lambda s: s.metrics["restart_count"] >= 5,
    ],
    "root_cause": "application crash loop: repeated process exit due to code or config error",
    "affected_services": lambda s: [s.service],
    "confidence": 0.90,
    "recommended_fix": "rollback deployment to last stable version or fix application config",
}
```

**Matching logic**: Both conditions (AND).  
**Confidence**: 0.90 (high — CrashLoopBackOff + 5+ restarts = clear code error).  
**What it detects**: Applications crashing repeatedly, unable to start successfully.

---

### FP-003: Image Pull Failure (ImagePullBackOff)

```python
{
    "id": "FP-003",
    "name": "image_pull_failure",
    "conditions": [
        lambda s: any(e["reason"] in {"ImagePullBackOff", "ErrImagePull"} for e in s.events),
    ],
    "root_cause": "image pull failure: incorrect image tag or missing registry credentials",
    "affected_services": lambda s: [s.service],
    "confidence": 0.92,
    "recommended_fix": "patch deployment with correct image tag or update imagePullSecret",
}
```

**Matching logic**: Single condition (ImagePullBackOff or ErrImagePull event).  
**Confidence**: 0.92 (very high — image pull event is definitive).  
**What it detects**: Kubernetes unable to pull container image (wrong tag, missing creds, registry down).

---

### FP-004: Infrastructure Saturation (FailedScheduling)

```python
{
    "id": "FP-004",
    "name": "infra_resource_saturation",
    "conditions": [
        lambda s: any(e["reason"] == "FailedScheduling" for e in s.events),
    ],
    "root_cause": "infra saturation: pods cannot be scheduled due to node resource pressure",
    "affected_services": lambda s: [s.service],
    "confidence": 0.88,
    "recommended_fix": "scale node group or remove resource-heavy pods",
}
```

**Matching logic**: Single condition (FailedScheduling event).  
**Confidence**: 0.88 (high — scheduling failure is clear infra issue).  
**What it detects**: Cluster running out of CPU/memory/disk to schedule new pods.

---

### FP-005: Database Connection Pool Saturation

```python
{
    "id": "FP-005",
    "name": "db_connection_pool_saturation",
    "conditions": [
        lambda s: float(s.metrics["latency_delta"].replace("x", "")) >= 2.0,
        lambda s: any("timeout" in sig["signature"].lower() or
                     "connection" in sig["signature"].lower()
                     for sig in s.logs_summary),
    ],
    "root_cause": "database connection pool saturation: requests queuing behind exhausted pool",
    "affected_services": lambda s: [s.service, "db-primary"],
    "confidence": 0.82,
    "recommended_fix": "increase connection pool size or restart service to clear pool state",
}
```

**Matching logic**: Both conditions (AND) — latency spike + connection/timeout log signatures.  
**Confidence**: 0.82 (medium-high — correlation of multiple signals).  
**What it detects**: Database clients unable to obtain connections from pool; requests queue and timeout.

---

## Stage 2: Feature Extraction (13 Features)

After fingerprint matching, we extract 13 features from the incident snapshot. These are used for:

1. **Confidence scoring**: Higher feature signal strength = higher confidence
2. **Fallback decision**: If rule confidence < 75%, use features to decide whether to call LLM
3. **Audit/explanation**: Features recorded in DiagnosisPayload for transparency

### Feature Categories

#### Metrics-Based Features (4)

| Feature              | Calculation            | Range | Purpose                |
| -------------------- | ---------------------- | ----- | ---------------------- |
| `cpu_pct_now`        | Current CPU usage %    | 0–100 | Detect CPU throttling  |
| `memory_pct_now`     | Current memory usage % | 0–100 | Detect memory pressure |
| `restart_count`      | Pod restart count      | 0–∞   | Detect crash loops     |
| `latency_multiplier` | Latency now ÷ baseline | 1.0–∞ | Detect degradation     |

#### Signal-Based Features (5)

| Feature               | Calculation                   | Range  | Purpose                   |
| --------------------- | ----------------------------- | ------ | ------------------------- |
| `cpu_z_score`         | (CPU − mean) ÷ σ              | -∞–+∞  | Baseline-relative anomaly |
| `memory_z_score`      | (Memory − mean) ÷ σ           | -∞–+∞  | Baseline-relative anomaly |
| `latency_z_score`     | (Latency − mean) ÷ σ          | -∞–+∞  | Baseline-relative anomaly |
| `burst_restarts_flag` | Sudden jump in restart count? | 0 or 1 | Detect crash bursts       |
| `burst_latency_flag`  | Latency > 2x baseline?        | 0 or 1 | Detect performance cliffs |

#### Log/Event Features (4)

| Feature                 | Calculation                     | Range  | Purpose               |
| ----------------------- | ------------------------------- | ------ | --------------------- |
| `top_error_signature`   | Most frequent error message     | string | Root cause hint       |
| `top_event_reason`      | Most frequent event reason      | string | Infrastructure signal |
| `error_signature_count` | Number of unique error messages | 0–∞    | Symptom diversity     |
| `event_frequency_score` | Events per 5-minute window      | 0–∞    | Anomaly rate          |

### Feature Extraction Code

```python
# From backend/diagnosis/feature_extractor.py

def extract_features(snapshot: IncidentSnapshot) -> FeatureVector:
    """Extract 13 features from incident snapshot."""

    # Metrics
    cpu_pct = snapshot.metrics.get("cpu_pct", 0)
    memory_pct = snapshot.metrics.get("memory_pct", 0)
    restart_count = snapshot.metrics.get("restart_count", 0)
    latency_multiplier = float(snapshot.metrics.get("latency_delta", "1.0x").replace("x", ""))

    # Z-scores (using 20% ± 5% as baseline for CPU/memory)
    cpu_z = (cpu_pct - 20) / 5 if cpu_pct > 0 else 0
    memory_z = (memory_pct - 20) / 5 if memory_pct > 0 else 0
    latency_z = (latency_multiplier - 1.0) / 0.5 if latency_multiplier > 1 else 0

    # Burst detection
    burst_restarts = 1 if restart_count > 10 else 0
    burst_latency = 1 if latency_multiplier >= 2.0 else 0

    # Top signatures (from logs_summary and events)
    top_error_sig = (snapshot.logs_summary[0]["signature"]
                     if snapshot.logs_summary else "no-errors")
    top_event_reason = max(
        (e["reason"] for e in snapshot.events),
        key=lambda r: sum(1 for e in snapshot.events if e["reason"] == r),
        default="no-events"
    )

    error_sig_count = len(set(s["signature"] for s in snapshot.logs_summary))
    event_freq = len(snapshot.events) / 5  # Assume 5-minute window

    return FeatureVector(
        cpu_pct_now=cpu_pct,
        memory_pct_now=memory_pct,
        restart_count=restart_count,
        latency_multiplier=latency_multiplier,
        cpu_z_score=round(cpu_z, 2),
        memory_z_score=round(memory_z, 2),
        latency_z_score=round(latency_z, 2),
        burst_restarts_flag=burst_restarts,
        burst_latency_flag=burst_latency,
        top_error_signature=top_error_sig,
        top_event_reason=top_event_reason,
        error_signature_count=error_sig_count,
        event_frequency_score=event_freq,
    )
```

---

## Matching Algorithm

```python
def match_fingerprints(snapshot: IncidentSnapshot) -> List[DiagnosisResult]:
    """Match snapshot against all fingerprints; return matches sorted by confidence."""

    matches = []
    for fingerprint in FINGERPRINT_CATALOG:
        # Evaluate all conditions (AND logic)
        all_conditions_met = all(
            condition(snapshot)
            for condition in fingerprint["conditions"]
        )

        if all_conditions_met:
            # Extract features for explanation
            features = extract_features(snapshot)

            matches.append(DiagnosisResult(
                fingerprint_id=fingerprint["id"],
                root_cause=fingerprint["root_cause"],
                confidence=fingerprint["confidence"],
                affected_services=fingerprint["affected_services"](snapshot),
                recommended_fix=fingerprint["recommended_fix"],
                features=features,  # For audit trail
            ))

    # Return sorted by confidence (highest first)
    return sorted(matches, key=lambda m: m.confidence, reverse=True)
```

---

## Example Walkthrough: OOM Incident

**Incident snapshot**:

```json
{
  "service": "payments-api",
  "metrics": {
    "cpu_pct": 45,
    "memory_pct": 95,
    "restart_count": 2,
    "latency_delta": "1.1x"
  },
  "events": [
    { "reason": "OOMKilled", "timestamp": "2024-04-16T10:23:15Z" },
    { "reason": "Created", "timestamp": "2024-04-16T10:23:10Z" }
  ],
  "logs_summary": []
}
```

**Matching process**:

1. Check FP-001 (OOMKilled):
   - Condition 1: `any(e["reason"] == "OOMKilled" for e in events)` ✅ (true)
   - Condition 2: `int(memory_pct) >= 90` ✅ (95 >= 90 = true)
   - **MATCH** → confidence 0.95

2. Check FP-002 (CrashLoop):
   - Condition 1: `any(e["reason"] in {...} for e in events)` ❌ (OOMKilled ≠ CrashLoopBackOff)
   - **NO MATCH**

3. Check FP-003, FP-004, FP-005:
   - **NO MATCH** (conditions not met)

**Output**:

```json
{
  "fingerprint_id": "FP-001",
  "root_cause": "memory exhaustion: container exceeded memory limit",
  "confidence": 0.95,
  "affected_services": ["payments-api"],
  "recommended_fix": "increase memory limit or restart pod to clear state",
  "features": {
    "cpu_pct_now": 45,
    "memory_pct_now": 95,
    "restart_count": 2,
    "latency_multiplier": 1.1,
    "cpu_z_score": 5.0,
    "memory_z_score": 15.0,
    "burst_restarts_flag": 0,
    "burst_latency_flag": 0,
    "top_error_signature": "no-errors",
    "top_event_reason": "OOMKilled",
    "error_signature_count": 0,
    "event_frequency_score": 2.0
  }
}
```

**Decision**: Confidence 0.95 > 75% threshold → Skip LLM fallback, return diagnosis directly to planner.

---

## Test Coverage (9 Tests)

**File**: `backend/tests/test_diagnosis_agents.py`

| Test                              | What It Validates                     | Input                           | Expected Output               |
| --------------------------------- | ------------------------------------- | ------------------------------- | ----------------------------- |
| `test_fp001_oom_matched`          | FP-001 fingerprint matching           | OOMKilled event + 95% memory    | Confidence 0.95               |
| `test_fp002_crash_loop_matched`   | FP-002 fingerprint matching           | CrashLoopBackOff + 8 restarts   | Confidence 0.90               |
| `test_fp003_image_pull_matched`   | FP-003 fingerprint matching           | ImagePullBackOff event          | Confidence 0.92               |
| `test_fp004_scheduling_matched`   | FP-004 fingerprint matching           | FailedScheduling event          | Confidence 0.88               |
| `test_fp005_db_pool_matched`      | FP-005 fingerprint matching           | Latency 2.5x + timeout logs     | Confidence 0.82               |
| `test_no_fingerprint_matched`     | No match scenario                     | Unrelated metrics/events        | Empty match list              |
| `test_feature_extraction_metrics` | Feature extraction (metrics)          | CPU/memory/restart metrics      | Correct z-scores, multipliers |
| `test_feature_extraction_logs`    | Feature extraction (logs/events)      | Event stream + error signatures | Top signatures + frequency    |
| `test_confidence_ranking`         | Multiple matches sorted by confidence | Multiple matching fingerprints  | Highest confidence first      |

---

## Running the Tests

```bash
cd hacktofuture4-A07

# Run diagnosis tests only
pytest backend/tests/test_diagnosis_agents.py -v

# Run with coverage
pytest backend/tests/test_diagnosis_agents.py --cov=backend/diagnosis

# Example output
# test_fp001_oom_matched PASSED
# test_fp002_crash_loop_matched PASSED
# test_fp003_image_pull_matched PASSED
# test_fp004_scheduling_matched PASSED
# test_fp005_db_pool_matched PASSED
# test_no_fingerprint_matched PASSED
# test_feature_extraction_metrics PASSED
# test_feature_extraction_logs PASSED
# test_confidence_ranking PASSED
# ===== 9 passed in 0.05s =====
```

---

## Key Design Decisions

### 1. Condition Evaluation Logic (AND)

All conditions in a fingerprint must be true for a match. This ensures high precision and reduces false positives.

**Example**: FP-001 requires BOTH OOMKilled event AND memory >= 90%. If only one condition is true, no match.

### 2. Confidence Scores (Fixed, Not Computed)

Each fingerprint has a hardcoded confidence score based on how definitive the pattern is.

- **0.95** (FP-001 OOM): Kernel OOMKilled event + high memory = very definitive
- **0.82** (FP-005 DB pool): Latency spike + timeout logs = correlation-based, less definitive

### 3. Z-Score Normalization for Features

Z-scores capture how far a metric is from normal baseline, rather than absolute values. This makes diagnosis more portable across different infrastructure sizes/configurations.

**Example**:

- CPU = 60% on a small cluster → z-score = 8 (anomalous)
- CPU = 60% on a large cluster → z-score = 8 (same relative anomaly)

### 4. Burst Detection Flags

Binary flags (0 or 1) for sudden spikes rather than continuous values. This is because crash loops and latency cliffs are either happening or not.

---

## Integration Points

### Input: IncidentSnapshot

Expected fields from Monitor Agent:

- `service`: Service name
- `metrics`: CPU%, memory%, restart count, latency
- `events`: Kubernetes event stream
- `logs_summary`: Top error signatures + counts

### Output: DiagnosisResult (Primary Match)

Returned to Planner Agent if confidence >= 75%:

- `fingerprint_id`: Pattern matched (e.g., "FP-001")
- `root_cause`: Human-readable diagnosis
- `confidence`: 0.0–1.0 score
- `affected_services`: List of impacted services
- `recommended_fix`: Suggested remediation
- `features`: Full feature vector (for audit)

### Fallback Decision

If best match confidence < 75%, call LLM fallback (Phase 2).

---

## Next: Phase 2 (LLM Fallback)

When rule confidence is low, Phase 2 activates the LLM fallback diagnosis layer. See [02-phase2-llm-fallback.md](02-phase2-llm-fallback.md) for details.
