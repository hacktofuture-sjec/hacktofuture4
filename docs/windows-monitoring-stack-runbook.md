# Windows Monitoring Stack Runbook (PowerShell)

This runbook is for running the full local stack on Windows:

- Kubernetes cluster (kind)
- Monitoring stack (Prometheus, Loki, Tempo, Grafana)
- Backend API (FastAPI)
- Optional frontend (Next.js)

It includes:

- What to install
- What to run and in what order
- How to verify each stage
- How to troubleshoot common failures
- How to stop and clean up safely

If you want the shortest path, use these scripts first:

- [scripts/windows-setup.ps1](../scripts/windows-setup.ps1) for one-time setup
- [scripts/windows-start.ps1](../scripts/windows-start.ps1) for daily startup
- [scripts/windows-stop.ps1](../scripts/windows-stop.ps1) for clean shutdown

---

## 1. Prerequisites

### 1.1 System requirements

- Windows 10/11
- PowerShell 7+ recommended
- Docker Desktop running with Kubernetes-compatible backend
- Internet access for pulling images/charts

### 1.2 Install all required tools

Run PowerShell as Administrator:

```powershell
winget install -e --id Docker.DockerDesktop
winget install -e --id Kubernetes.kubectl
winget install -e --id Kubernetes.kind
winget install -e --id Helm.Helm
winget install -e --id loft-sh.vcluster
winget install -e --id astral-sh.uv
```

### 1.3 Verify installations

```powershell
docker --version
kubectl version --client
kind version
helm version
vcluster --version
uv --version
```

Expected: all commands print versions without errors.

---

## 2. One-Time Infrastructure Setup

Go to repository root:

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
```

### 2.1 Start Docker Desktop first

Wait until Docker Desktop shows engine is running.

Verify:

```powershell
docker info
```

### 2.2 Create kind cluster

```powershell
kind create cluster --name t3ps2 --config k8s\kind-config.yaml
kubectl cluster-info
kubectl get nodes
```

Expected:

- cluster-info prints control plane endpoint
- get nodes shows at least one Ready node

### 2.3 Add/update Helm repos

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### 2.4 Create namespaces

```powershell
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace prod --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace vcluster-sandboxes --dry-run=client -o yaml | kubectl apply -f -
```

### 2.5 Install Prometheus, Loki, Tempo, Grafana

```powershell
helm upgrade --install prometheus prometheus-community/prometheus `
  --namespace monitoring `
  -f k8s/monitoring/prometheus-values.yaml `
  --wait --timeout 3m

helm upgrade --install loki grafana/loki-stack `
  --namespace monitoring `
  -f k8s/monitoring/loki-values.yaml `
  --wait --timeout 3m

helm upgrade --install tempo grafana/tempo `
  --namespace monitoring `
  -f k8s/monitoring/tempo-values.yaml `
  --wait --timeout 3m

helm upgrade --install grafana grafana/grafana `
  --namespace monitoring `
  -f k8s/monitoring/grafana-values.yaml `
  --wait --timeout 3m
```

### 2.6 Deploy sample app workloads

```powershell
kubectl apply -f k8s/sample-app.yaml
kubectl wait --for=condition=ready pod --all -n monitoring --timeout=180s
kubectl wait --for=condition=ready pod --all -n prod --timeout=180s
```

### 2.7 Confirm monitoring services are present

```powershell
kubectl get pods -n monitoring
kubectl get svc -n monitoring
kubectl get pods -n prod
```

---

## 3. Runtime Sequence (Every Session)

Use separate PowerShell terminals.

### Terminal A: Port-forward Prometheus

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
kubectl port-forward svc/prometheus-server 9090:80 -n monitoring
```

### Terminal B: Port-forward Loki

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
kubectl port-forward svc/loki 3100:3100 -n monitoring
```

### Terminal C: Port-forward Tempo

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
kubectl port-forward svc/tempo 3200:3200 -n monitoring
```

### Terminal D: Port-forward Grafana

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
kubectl port-forward svc/grafana 3300:80 -n monitoring
```

### Terminal E: Backend API

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07\backend

# Create venv once (repeat only if missing)
uv venv --python 3.12 venv

# Activate
.\venv\Scripts\Activate.ps1

# Install dependencies
uv pip install -r requirements.txt

# Optional clean DB reset
if (Test-Path data\t3ps2.db) { Remove-Item data\t3ps2.db -Force }

# Initialize DB schema
python init_db.py

# Run backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal F: Frontend (optional)

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07\frontend
npm install
npm run dev
```

---

## 4. Health and Functional Checks

Run in a separate PowerShell terminal.

### 4.1 Core health checks

```powershell
curl http://localhost:8000/healthz
curl http://localhost:9090/-/healthy
curl http://localhost:3100/ready
curl http://localhost:3200/ready
curl http://localhost:3300/api/health
```

Expected:

- backend health status ok
- Prometheus healthy
- Loki ready
- Tempo ready
- Grafana health ok

### 4.2 Load scenarios

```powershell
curl -X POST http://localhost:8000/admin/load-scenarios
curl http://localhost:8000/scenarios
```

Expected:

- load returns 4 scenarios
- scenarios endpoint lists scenario IDs

### 4.3 Test monitor and pipeline endpoints

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/monitor" -Method POST | Select-Object -ExpandProperty Content

$pipelineBody = '{"context":{"deployment":"payment-api","namespace":"default"}}'
Invoke-WebRequest -Uri "http://localhost:8000/pipeline" -Method POST -ContentType "application/json" -Body $pipelineBody | Select-Object -ExpandProperty Content

curl http://localhost:8000/cost-report
```

### 4.4 Test fault injection endpoint

```powershell
$body = '{"scenario_id":"oom-kill-001","force":false}'
Invoke-WebRequest -Uri "http://localhost:8000/inject-fault" -Method POST -ContentType "application/json" -Body $body | Select-Object -ExpandProperty Content
```

Expected:

- returns snapshot JSON (not HTTP 500)

If you get HTTP 500 here, see Troubleshooting section 5.1.

---

## 5. Troubleshooting

### 5.1 HTTP 500 on /inject-fault

Likely cause: backend can call kubectl, but cluster context is missing/unreachable.

Check:

```powershell
kubectl config current-context
kubectl get ns
```

If connection is refused on localhost:8080:

- kind cluster is not running
- or current kube context is wrong

Fix:

```powershell
kind get clusters
kind create cluster --name t3ps2 --config k8s\kind-config.yaml  # only if missing
kubectl config get-contexts
kubectl config use-context kind-t3ps2
kubectl get ns
```

### 5.2 Backend startup warnings for Prometheus/Loki/Tempo

Warnings like not reachable mean port-forwards are not active.

Fix:

- Ensure terminals A-D are running port-forwards
- Re-test:

```powershell
curl http://localhost:9090/-/healthy
curl http://localhost:3100/ready
curl http://localhost:3200/ready
```

### 5.3 Helm install timeouts

Possible causes:

- slow image pull
- Docker resource limits too low

Checks:

```powershell
kubectl get pods -n monitoring
kubectl describe pod -n monitoring <pod-name>
kubectl get events -n monitoring --sort-by=.lastTimestamp
```

### 5.4 Port already in use

If port-forward fails due to local port conflicts, find process:

```powershell
netstat -ano | findstr :9090
netstat -ano | findstr :3100
netstat -ano | findstr :3200
netstat -ano | findstr :3300
```

Kill conflicting PID if needed:

```powershell
Stop-Process -Id <PID> -Force
```

---

## 6. Clean Shutdown

### 6.1 Stop runtime processes

- In each running terminal, press Ctrl+C for:
  - backend uvicorn
  - frontend dev server
  - each kubectl port-forward

### 6.2 Optional full cluster teardown

```powershell
kind delete cluster --name t3ps2
```

### 6.3 Optional backend DB reset

```powershell
Set-Location C:\Users\vivek\projects\hacktofuture\hacktofuture4-A07\backend
if (Test-Path data\t3ps2.db) { Remove-Item data\t3ps2.db -Force }
```

---

## 7. Quick Daily Checklist

1. Start Docker Desktop
2. Confirm cluster is reachable
3. Start 4 port-forwards (Prometheus/Loki/Tempo/Grafana)
4. Start backend
5. Load scenarios
6. Validate health endpoints
7. Run monitor/pipeline/inject-fault checks

---

## 8. Useful URLs

- Backend API docs: http://localhost:8000/docs
- Backend health: http://localhost:8000/healthz
- Prometheus: http://localhost:9090
- Loki ready: http://localhost:3100/ready
- Tempo ready: http://localhost:3200/ready
- Grafana: http://localhost:3300

Default Grafana credentials are defined by your Helm values in k8s/monitoring/grafana-values.yaml.
