# Nova Chat Kubernetes Demo

This folder contains simple Minikube-ready Kubernetes manifests for Nova Chat.

## Current Status

All services are **running and ready** on Minikube:  
✅ frontend (Vite dev server)  
✅ auth-service (MongoDB connected)  
✅ messaging-service (MongoDB connected)  
✅ presence-service  
✅ agent-service  
✅ mongo (database)

## Quick Start

To test the app on your Windows machine:

```powershell
# Terminal 1: Forward frontend
kubectl port-forward svc/frontend 5173:5173

# Terminal 2: Open in browser
start http://localhost:5173
```

To test from another laptop on the same Wi-Fi:

```powershell
# Terminal 1 on your Windows machine (keep running)
minikube tunnel

# Terminal 2 on another laptop, replace with your Windows LAN IP:
# http://192.168.1.100:30017
```

## What these manifests do

- Deploy one pod for each service
- Use `imagePullPolicy: Never` for locally built images
- Keep internal service-to-service traffic on Kubernetes service names
- Expose the frontend, auth, messaging, presence, and agent services with `NodePort`
- Keep MongoDB internal with `ClusterIP`
- Persist MongoDB data with a small PVC

## Before you apply

If you built your images with Docker Desktop and want Minikube to use those same local images, switch your Docker environment to Minikube first:

```powershell
minikube docker-env --shell powershell | Invoke-Expression
```

If you already built the images into Minikube's Docker runtime, you can skip that step.

If needed, build images after switching the Docker environment:

```powershell
docker build -t nova-chat-frontend ./frontend
docker build -t nova-chat-auth-service ./auth-service
docker build -t nova-chat-messaging-service ./messaging-service
docker build -t nova-chat-presence-service ./presence-service
docker build -t nova-chat-agent-service ./agent-service
docker build -t nova-chat-security-service ./security-service
```

## Important: Set your Groq API key

Before applying manifests, open [agent-secret.yaml](agent-secret.yaml) and replace `REPLACE_ME_WITH_YOUR_GROQ_API_KEY` with your actual Groq API key:

```yaml
stringData:
  GROQ_API_KEY: gsk_YOUR_ACTUAL_KEY_HERE
```

Then apply the secret:

```powershell
kubectl apply -f k8s/agent-secret.yaml
```

Or update it later:

```powershell
kubectl create secret generic agent-secret --from-literal=GROQ_API_KEY="gsk_YOUR_KEY" --dry-run=client -o yaml | kubectl apply -f -
```

From the repository root:

```powershell
kubectl apply -f .\k8s\
```

Or apply the files individually:

```powershell
kubectl apply -f k8s/mongo-pvc.yaml
kubectl apply -f k8s/mongo-deployment.yaml
kubectl apply -f k8s/mongo-service.yaml
kubectl apply -f k8s/auth-deployment.yaml
kubectl apply -f k8s/auth-service.yaml
kubectl apply -f k8s/messaging-deployment.yaml
kubectl apply -f k8s/messaging-service.yaml
kubectl apply -f k8s/presence-deployment.yaml
kubectl apply -f k8s/presence-service.yaml
kubectl apply -f k8s/security-deployment.yaml
kubectl apply -f k8s/security-service.yaml
kubectl apply -f k8s/agent-secret.yaml
kubectl apply -f k8s/agent-rbac.yaml
kubectl apply -f k8s/agent-deployment.yaml
kubectl apply -f k8s/agent-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

## Check status

```powershell
kubectl get pods
kubectl get services
kubectl get pvc
```

## Open the frontend (Windows)

On Windows, the Minikube VM networking is isolated. Use one of these methods:

### Option 1: Use kubectl port-forward (Easiest for local testing)

In PowerShell, forward the frontend port to localhost:

```powershell
kubectl port-forward svc/frontend 5173:5173
```

Then open:
- `http://localhost:5173`

### Option 2: Use minikube service (Opens in browser)

```powershell
minikube service frontend
```

### Option 3: Access from another laptop on the same network

If you want your phone or another laptop on the same Wi-Fi to access the app:

1. Get your Windows machine's LAN IP:
   ```powershell
   ipconfig | findstr "IPv4"
   ```
   Look for your active network adapter's IPv4 address (e.g., `192.168.1.100`).

2. Enable Minikube NodePort forwarding to Windows host:
   ```powershell
   minikube tunnel
   ```
   (Keep this running in a separate PowerShell window)

3. Then use your Windows LAN IP with the NodePorts:
   - Frontend: `http://WINDOWS_LAN_IP:30017`
   - Auth: `http://WINDOWS_LAN_IP:30011`
   - Messaging: `http://WINDOWS_LAN_IP:30012`
   - Presence: `http://WINDOWS_LAN_IP:30013`
   - Agent: `http://WINDOWS_LAN_IP:30014`
   - Security: `http://WINDOWS_LAN_IP:30015`

## Access the services from your localhost

For local testing, use `kubectl port-forward` for each service you need:

```powershell
kubectl port-forward svc/auth-service 3001:3001
kubectl port-forward svc/messaging-service 3002:3002
kubectl port-forward svc/presence-service 3003:3003
kubectl port-forward svc/agent-service 4000:4000
kubectl port-forward svc/frontend 5173:5173
```

Then use:
- Frontend: `http://localhost:5173`
- Auth: `http://localhost:3001`
- Messaging: `http://localhost:3002`
- Presence: `http://localhost:3003`
- Agent: `http://localhost:4000`

Simulation endpoints work via port-forward or Postman:

With port-forward:

```powershell
kubectl port-forward svc/auth-service 3001:3001
kubectl port-forward svc/messaging-service 3002:3002
kubectl port-forward svc/presence-service 3003:3003

# In another PowerShell window:
Invoke-RestMethod -Method Get -Uri http://localhost:3001/simulate/status
Invoke-RestMethod -Method Get -Uri http://localhost:3002/simulate/status
Invoke-RestMethod -Method Post -Uri http://localhost:3002/simulate/crash
```

With Postman (from another laptop):

1. Make sure `minikube tunnel` is running on your Windows machine
2. Use your Windows LAN IP + NodePorts in Postman:
   - `GET http://192.168.1.100:30011/simulate/status`
   - `POST http://192.168.1.100:30012/simulate/crash`
   - `GET http://192.168.1.100:30014/agent/status`

## Test the agent flow (with kubectl port-forward)

In one PowerShell window, set up port-forwarding:

```powershell
kubectl port-forward svc/agent-service 4000:4000
kubectl port-forward svc/messaging-service 3002:3002
```

In another PowerShell window, run tests:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/agent/status
Invoke-RestMethod -Method Get -Uri http://localhost:4000/agent/analyze
Invoke-RestMethod -Method Post -Uri http://localhost:3002/simulate/crash
Invoke-RestMethod -Method Post -Uri http://localhost:4000/agent/heal
Invoke-RestMethod -Method Get -Uri http://localhost:4000/agent/status
```

For the advanced configuration-healing demo:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:4000/agent/analyze
Invoke-RestMethod -Method Post -Uri http://localhost:4000/agent/advanced-heal
```

Expected response highlights:

- `kubernetesBefore.restartCount` shows repeated restarts
- `rca.rootCauseType` is `configuration`
- `decision.action` is `patch_configuration`
- `remediation.message` confirms `MAX_CONNECTIONS` was patched to `10`
- `monitoringAfter.overall` should return to `healthy` after rollout completes

Or test with Postman on another laptop:

1. Run `minikube tunnel` on your Windows machine to expose NodePorts
2. In Postman, replace `localhost` with your Windows LAN IP and use the NodePorts (e.g., `http://192.168.1.100:30014/agent/status`)

## View logs

```powershell
kubectl logs deployment/frontend
kubectl logs deployment/auth-service
kubectl logs deployment/messaging-service
kubectl logs deployment/presence-service
kubectl logs deployment/agent-service
kubectl logs deployment/mongo
```

For a specific pod:

```powershell
kubectl logs pod/<pod-name>
```

## Delete everything

```powershell
kubectl delete -f .\k8s\
```

If you want to remove the PVC too and start fresh:

```powershell
kubectl delete pvc mongo-pvc
```

## Notes on frontend proxying

The frontend runs as the Vite dev server inside the cluster and is exposed with `NodePort`. That is the simplest setup because browser requests stay same-origin at the frontend URL, and the Vite proxy forwards `/api/auth`, `/api/messaging`, `/api/presence`, and `/api/agent` to Kubernetes service names such as `http://auth-service:3001`.

That means:

- laptop browser works at `http://LAPTOP_LOCAL_IP:30017`
- phone browser on the same Wi-Fi works at the same URL
- frontend code does not need hardcoded localhost API URLs
- internal pod-to-pod communication uses Kubernetes DNS names
