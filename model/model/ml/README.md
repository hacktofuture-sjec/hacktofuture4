# ML Module - Self-Healing Kubernetes Pipeline

A multi-stage, production-inspired ML pipeline for intelligent Kubernetes failure detection, classification, root-cause analysis, and automated remediation.

---

## Architecture

```
Raw Telemetry (window of 3-5 readings)
        |
  [1] Validation         -- sanitise, clip, fill missing
        |
  [2] Feature Eng.       -- compute trends (cpu_trend, latency_trend, etc.)
        |
  [3] Anomaly Detection  -- IsolationForest anomaly scoring
        |
  [4] Classification     -- RandomForest failure prediction + confidence
        |
  [5] RCA Correlation    -- combine ML + signals into root cause report
        |
  [6] Decision Engine    -- map prediction + confidence to action
        |
  [7] Safety Policies    -- guardrails (max replicas, cooldown, thresholds)
        |
  [8] Verification       -- post-heal outcome checking
        |
  [9] Incident Memory    -- store event for learning
```

---

## Pipeline Stages

### 1. Validation (`pipeline/validation.py`)
- Fills missing values with safe defaults
- Clips values to realistic ranges (e.g. CPU 0-100%)
- Ensures correct types (int vs float)
- Validates logical constraints (available_replicas <= replicas)

### 2. Feature Engineering (`pipeline/feature_engineering.py`)
- Takes a sliding window of 3-5 telemetry readings
- Computes normalised trend slopes:
  - `cpu_trend` - CPU direction
  - `latency_trend` - latency direction
  - `restart_growth_rate` - are restarts accelerating?
  - `error_rate_trend` - error direction
  - `memory_trend` - memory direction
- Positive slope = worsening, Negative = improving

### 3. Anomaly Detection (`pipeline/anomaly.py`)
- Uses **IsolationForest** to detect novel/unusual telemetry patterns
- Runs BEFORE classification to catch unknown failure modes
- Outputs `anomaly_score` and `is_anomalous` flag
- If anomaly + healthy classification = escalate to ALERT

### 4. Classification (`pipeline/classifier.py`)
- **RandomForestClassifier** predicts failure class:
  - `healthy` | `latency_issue` | `service_error` | `crash_loop` | `overload`
- Uses `predict_proba` for confidence scoring (0-1)
- Returns full probability distribution across all classes

### 5. RCA Correlation (`pipeline/rca.py`)
- Combines ML prediction with raw signal analysis
- Identifies elevated signals (high CPU, high errors, replica deficit, etc.)
- Produces structured root cause report with:
  - severity level (info / warning / critical)
  - contributing factors
  - evidence dict

### 6. Decision Engine (`pipeline/decision.py`)
- ML + rule hybrid system
- Maps `(predicted_class, confidence_level)` to action:
  - `SCALE_DEPLOYMENT` - increase replicas
  - `RESTART_POD` - restart failing pods
  - `ALERT_ONLY` - notify SRE, no auto-action
  - `NO_ACTION` - system healthy
- Low confidence always defaults to ALERT_ONLY

### 7. Safety Policies (`pipeline/safety.py`)
- **Max replicas**: won't scale beyond 10
- **Confidence threshold**: need >= 0.70 for auto-action
- **Cooldown**: 2-minute minimum between auto-actions per service
- **Zero-replica fallback**: if no pods running, switch RESTART to SCALE

### 8. Verification (`pipeline/verification.py`)
- Simulates post-heal telemetry check
- 5 verification checks:
  - latency reduced?
  - restarts cleared?
  - replicas healthy?
  - service reachable?
  - CPU stabilised?
- Success = 60%+ checks passing

### 9. Incident Memory (`pipeline/memory.py`)
- Stores every pipeline event as JSON Lines
- Records: telemetry -> prediction -> action -> outcome
- Provides history retrieval and summary statistics
- Simulates a learning system

---

## How Confidence Affects Decisions

| Confidence | Level | Auto-remediate? |
|-----------|-------|----------------|
| >= 0.85 | High | Yes (if safe) |
| >= 0.70 | Medium | Yes (if safe) |
| < 0.70 | Low | No - ALERT only |

---

## How This Reduces MTTR

1. **Anomaly detection** catches issues before they become critical
2. **Automated classification** eliminates manual triage time
3. **RCA correlation** pinpoints root cause instantly
4. **Auto-remediation** executes fixes in seconds, not minutes
5. **Safety policies** prevent cascading failures
6. **Verification** confirms fixes worked, re-escalates if not
7. **Incident memory** enables pattern learning over time

---

## Folder Structure

```
ml/
|-- data/
|   |-- telemetry_dataset.csv
|   |-- incident_history.jsonl      (created on first pipeline run)
|-- models/
|   |-- classifier.pkl
|   |-- anomaly_model.pkl
|   |-- label_encoder.pkl
|   |-- confusion_matrix.png
|-- pipeline/
|   |-- __init__.py
|   |-- validation.py
|   |-- feature_engineering.py
|   |-- anomaly.py
|   |-- classifier.py
|   |-- rca.py
|   |-- decision.py
|   |-- safety.py
|   |-- verification.py
|   |-- memory.py
|-- generate_dataset.py
|-- train_model.py
|-- train_anomaly.py
|-- run_pipeline.py
|-- predict.py
|-- README.md
```

---

## Quick Start

```bash
# 1. Generate synthetic dataset
python generate_dataset.py

# 2. Train failure classifier
python train_model.py

# 3. Train anomaly detector
python train_anomaly.py

# 4. Run the full pipeline on demo scenarios
python run_pipeline.py
```

---

## Integration

Import the pipeline function directly:

```python
from ml.run_pipeline import run_pipeline

result = run_pipeline(
    telemetry_window=[reading1, reading2, reading3],
    service_name="api-gateway",
    verbose=False,
)

print(result["classification"]["predicted_class"])  # "overload"
print(result["safety"]["final_action"])             # "SCALE_DEPLOYMENT"
print(result["verification"]["status"])             # "success"
```

---

## Dependencies

- Python 3.8+
- pandas
- scikit-learn
- joblib
- numpy
- matplotlib (optional, for confusion matrix image)
