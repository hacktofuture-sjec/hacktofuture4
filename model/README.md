# Nova Chat — ML Anomaly-Detection Service

IsolationForest-based anomaly detection service for the SolutionSync / Nova Chat
self-healing cloud platform. Runs as a standalone FastAPI microservice.

---

## File Structure

```
ml-service/
├── app.py                  FastAPI application & routes
├── model.py                IsolationForest logic, feature extraction, scoring
├── schemas.py              Pydantic request/response models
├── train.py                Standalone training script
├── requirements.txt        Python dependencies
├── Dockerfile              Container image definition
├── k8s-deployment.yaml     Kubernetes Deployment + Service
├── agent-integration.js    Minimal patch for agent-service (JS/Node)
└── saved_model/            Auto-created; holds isolation_forest.joblib
```

---

## Quick Start (Local)

```bash
cd ml-service

# 1. Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Train baseline model (creates saved_model/isolation_forest.joblib)
python train.py

# 4. Start the service
uvicorn app:app --host 0.0.0.0 --port 5050 --reload
```

Service is now available at http://localhost:5050

Interactive docs: http://localhost:5050/docs

---

## Docker

```bash
# Build (pre-trains model inside image)
docker build -t ml-service:latest .

# Run
docker run -p 5050:5050 ml-service:latest
```

---

## Kubernetes / Minikube

```bash
# If using Minikube local image:
eval $(minikube docker-env)
docker build -t ml-service:latest .

# Deploy
kubectl apply -f k8s-deployment.yaml

# Verify
kubectl get pods -l app=ml-service
kubectl logs -l app=ml-service
```

---

## Environment Variables

| Variable       | Default                                    | Description                     |
|----------------|--------------------------------------------|---------------------------------|
| `MODEL_PATH`   | `saved_model/isolation_forest.joblib`      | Path to saved model file        |
| `ML_SERVICE_URL` | `http://ml-service:5050`                 | Used by agent-service to reach ML|

---

## API Endpoints

### GET /health
```json
{ "status": "healthy", "service": "ml-service" }
```

### POST /ml/analyze
Accepts telemetry, returns anomaly analysis.

### POST /ml/train
Retrains the IsolationForest on fresh synthetic baseline data.

### GET /ml/model-info
Returns model metadata.

---

## Test Payloads

### Normal — no anomalies expected
```bash
curl -X POST http://localhost:5050/ml/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "service": "auth-service",
        "latency": 120,
        "restartCount": 0,
        "error": false,
        "crash": false,
        "overload": false,
        "reachable": true,
        "replicas": 2
      },
      {
        "service": "messaging-service",
        "latency": 95,
        "restartCount": 0,
        "error": false,
        "crash": false,
        "overload": false,
        "reachable": true,
        "replicas": 2
      }
    ]
  }'
```

### Anomalous — high latency + overload on messaging-service
```bash
curl -X POST http://localhost:5050/ml/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "service": "auth-service",
        "latency": 120,
        "restartCount": 0,
        "error": false,
        "crash": false,
        "overload": false,
        "reachable": true,
        "replicas": 1
      },
      {
        "service": "messaging-service",
        "latency": 5000,
        "restartCount": 2,
        "error": false,
        "crash": false,
        "overload": true,
        "reachable": true,
        "replicas": 1
      }
    ]
  }'
```

### Critical — crash + unreachable
```bash
curl -X POST http://localhost:5050/ml/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "service": "presence-service",
        "latency": 9999,
        "restartCount": 5,
        "error": true,
        "crash": true,
        "overload": true,
        "reachable": false,
        "replicas": 0
      }
    ]
  }'
```

### Retrain
```bash
curl -X POST http://localhost:5050/ml/train
```

---

## Expected Response (anomalous case)

```json
{
  "success": true,
  "anomaly": true,
  "suspectedService": "messaging-service",
  "severity": "high",
  "confidence": 0.89,
  "reason": "High latency, Elevated restart count, Overload flag active detected",
  "scores": [
    { "service": "auth-service",      "anomaly": false, "score": 0.18 },
    { "service": "messaging-service", "anomaly": true,  "score": 0.89 }
  ]
}
```

---

## Agent Integration (mlInsight field)

After applying `agent-integration.js`, your `/agent/analyze` response gains:

```json
{
  "...existing fields unchanged...",
  "mlInsight": {
    "anomaly": true,
    "suspectedService": "messaging-service",
    "confidence": 0.89,
    "severity": "high",
    "reason": "High latency, Elevated restart count, Overload flag active detected",
    "scores": [...]
  }
}
```

`mlInsight` is `null` if the ML service is unreachable — the agent continues normally.

---

## Dashboard Integration Notes

The `mlInsight` object maps directly to UI components:

| Field             | UI Component                        |
|-------------------|-------------------------------------|
| `confidence`      | Confidence badge / progress bar     |
| `severity`        | Severity chip (low/medium/high/critical) |
| `suspectedService`| Highlighted service card            |
| `reason`          | RCA detail text                     |
| `scores[]`        | Per-service anomaly score table     |
