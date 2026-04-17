# Code Brigade - A01

Welcome to your official HackToFuture 4 repository.

## Problem Statement / Idea
- Cloud-native microservices deployed on Kubernetes are susceptible to runtime failures such as CrashLoopBackOff, resource exhaustion, and traffic spikes, making real-time system stability challenging.
- Existing solutions rely on threshold-based autoscaling and manual intervention, lacking context-aware decision-making, root cause analysis, and adaptive recovery mechanisms.
- Target users include DevOps engineers, SRE teams, and cloud platform operators who require automated, intelligent systems for self-healing, resilience, and performance optimization.

---

## Proposed Solution
- We are building an agent-driven, Kubernetes-based microservices platform that continuously monitors system health, performs root cause analysis (RCA), and autonomously executes remediation actions such as scaling and recovery.
- The system combines observability signals (logs, restart counts, latency) with ML-based prediction and a capacity-aware model to enable context-driven decision-making and graceful degradation under load.
- The uniqueness lies in its agentic architecture, where multiple specialized agents (SRE, Capacity, Learning, Log Intelligence) collaborate to create a self-healing, self-optimizing, and resilient infrastructure system.

---

## Features
- Agent-Based Self-Healing System — Autonomous monitoring, root cause analysis, and remediation using a centralized SRE agent with specialized supporting agents.
- Intelligent Scaling & Capacity Buffering — Context-aware scaling combined with dynamic reserve capacity to ensure graceful degradation and continuous service availability.
- ML-Driven Prediction & Learning Loop — Lightweight ML pipeline that predicts failures, learns from past incidents, and improves decision-making over time.

---

## Tech Stack
- Frontend: React.js (Dashboard UI for monitoring, visualization, and system insights)
- Backend: Node.js, Express.js (Microservices architecture with agent-based logic)
- Database: MongoDB / JSON-based storage (for logs, incidents, and ML dataset)
- APIs / Services: REST APIs, Kubernetes API (for deployments, scaling, and monitoring), Groq API (LLM-based reasoning)
- Tools / Libraries: Docker, Kubernetes (Minikube), Socket.IO, Axios, Tailwind CSS, @kubernetes/client-node

---

## Project Setup Instructions

```bash
## Step 1: Go to project root
cd "Nova Chat"

## Step 2: Install dependencies (all services)
Do this for each service:
cd auth-service
npm install

cd ../messaging-service
npm install

cd ../presence-service
npm install

cd ../agent-service
npm install

cd ../security-service
npm install

## Step 3: Setup environment variables
Create .env files in each service.
## Example (auth-service/.env)
PORT=3001
MONGO_URI=mongodb://<laptop-IP-Address>/nova-chat

## messaging-service
PORT=3002
MONGO_URI=mongodb://<laptop-IP-Address>/nova-chat

## presence-service
PORT=3003

## agent-service
PORT=4000
GROQ_API_KEY=your_key_here

## security-service
PORT=3005

## dashboard frontend
NEXT_PUBLIC_AGENT_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SECURITY_BASE_URL=http://localhost:3005

## Step 4: Start MongoDB (VERY IMPORTANT)
If local MongoDB:
mongod

OR if using Docker:
docker run -d -p 27017:27017 --name mongo mongo

## Step 5: Run dashboard frontend
cd dashboard
npm run dev
Open:
http://localhost:5173

## Step 6: Test system
Check:
http://localhost:4000/agent/analyze
http://localhost:3005/security/status
http://localhost:3005/security/alerts

## OPTION 2 — Docker (Better for demo)
## Step 1: Build all services
From root:
docker-compose build

## Step 2: Start all services
docker-compose up
OR background:
docker-compose up -d

## Step 3: Check running containers
docker ps

## Step 4: Open app
http://localhost:5173

## Step 5: Check logs
docker-compose logs -f

## OPTION 3 — Kubernetes
## Step 1: Start Minikube
minikube start --driver=docker

## Step 2: Enable Docker inside Minikube
eval $(minikube docker-env) 

## Step 3: Build images
docker build -t nova-chat-auth-service ./auth-service
docker build -t nova-chat-messaging-service ./messaging-service
docker build -t nova-chat-presence-service ./presence-service
docker build -t nova-chat-agent-service ./agent-service
docker build -t nova-chat-security-service ./security-service
docker build -t nova-chat-frontend ./dashboard

## Step 4: Apply Kubernetes configs
kubectl apply -f k8s/

## Step 5: Check pods
kubectl get pods

## Step 6: Check services
kubectl get svc

## Step 7: Port forward (VERY IMPORTANT)
Dashboard:
kubectl port-forward svc/frontend 5173:80

Agent:
kubectl port-forward svc/agent-service 4000:4000

Security:
kubectl port-forward svc/security-service 3005:3005

## Step 8: Open app
http://localhost:5173

## FINAL TEST COMMANDS
Check agent
curl http://localhost:4000/agent/analyze

Check security
curl http://localhost:3005/security/status
curl http://localhost:3005/security/alerts

## Demo testing commands
Trigger overload
curl -X POST http://localhost:3002/simulate/overload
```
