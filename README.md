# Product Intelligence Platform

A highly scalable SaaS platform orchestrating autonomous, LLM-driven actions securely across external tooling suites (Jira, Slack, Linear, HubSpot). The system utilizes an event-sourcing architecture mapped to a deterministic AI agent LangGraph state machine.

![Platform Concept](https://img.shields.io/badge/Architecture-Event%20Driven-blue) ![Postgres](https://img.shields.io/badge/Postgres-14-blue) ![LLM](https://img.shields.io/badge/Agent-Llama%203-purple) ![Monorepo](https://img.shields.io/badge/Manager-UV-yellow)

---

## 🏗️ Core Architecture Pattern
The system is bifurcated into two autonomous units bridging security and stateless intelligence.

### 1️⃣ Django Core Service (Resilience & Storage)
The primary backend governing data integrity, relationships, and user authorization mapping.
- **Data Layer:** PostgreSQL 14 (leveraging specific features like GIN Indexes for JSONB fields and Partial Indexing).
- **Control Layer:** Django REST Framework providing the API interface.
- **Workflow Orchestration:** Celery & Redis to handle high-volume ingress streams securely without disrupting HTTP interfaces.
- **Responsibilities:** Idempotency constraints, Organization multi-tenancy rules, Identity tracking, Webhook reception, Dead Letter Queue (DLQ) operations.

### 2️⃣ FastAPI Agent Service (Stateless Intelligence Layer)
An independent intelligent microservice designed exclusively to evaluate natural language.
- **Logic Mapping:** `LangGraph` defining explicit node-based state transitions.
- **Natural Language Parsing:** Natively hosts zero-shot LLM prompts to output strictly typed JSON Pydantic properties.
- **Providers:** Natively hooked via the **Model Context Protocol (MCP)** standard to integrate perfectly securely to target platforms.
- **Self-Healing:** Built-in validator nodes catch hallucinated payloads natively, appending the errors to the prompt for closed-loop, isolated retries.
- **CRITICAL RESTRICTION:** FastApi possesses absolutely zero database write capabilities to ensure the AI pipeline can never autonomously destruct system integrity. It communicates to Django via strictly typed internal URLs.

### 3️⃣ Web Frontend (Operator Console)
A Vite + React + TypeScript single-page application that operators use to administer the platform end-to-end.
- **Stack:** React 19, TypeScript, Tailwind, Framer Motion, React Router, Axios.
- **Auth:** JWT access + refresh tokens are obtained from the Django `/api/v1/auth/*` endpoints and stored client-side. A single-flight refresh interceptor transparently rotates expired access tokens on 401.
- **Coverage:** One page per `/api/v1/*` resource group — dashboard, insights, unified tickets (with activities/comments), raw events + DLQ (with one-click retry), integrations + accounts (with on-demand sync), processing runs + step transitions, chat sessions (SSE-capable streaming with JSON fallback), dashboards + widgets, saved queries, sync checkpoints, organization + members + invites, API keys, audit logs.
- **Voice Agent:** The original VoxBridge voice/action demo is preserved at `/agent` and talks directly to the FastAPI agent service (not Django), so the demo works with or without the backend online.
- **Boundary:** The frontend NEVER calls internal ApiKey routes (`/events/ingest`, `/tickets/upsert`, `/dlq`, `/identities/map`) — those remain service-to-service.

---

## 🧠 Core Engineering Principles

1. **Event Sourcing First**: All raw webhook payloads from Jira/Slack are immediately dropped into Postgres `JSONB` fields permanently before any AI processing occurs.
2. **Idempotency Assurance**: Enforces strict unique constraints `(integration_id, external_id)` so multiple webhooks never hallucinate duplicate tickets into the system.
3. **Structured AI Constraints**: Output constraints via strict `BaseModel` classes force 8B parameter inference nodes to adhere mathematical rules without guessing fields natively.

---

## 🧭 LangGraph Pipeline Overview

The active LangGraph State machine flows through the following graph properties organically based on payload integrity.

1. **Fetcher Node (MCP)**: Standardizes API pagination routines mapping directly to target tools and stores raw extraction inside the typed dictionaries.
2. **Mapper Node (LLM / LangChain)**: Prompts the unified state to local models natively converting random Webhook/User chat strings into `UnifiedTicketSchema`.
3. **Validator Node (Python native)**: Evaluates the specific generated structure verifying statuses (`open`, `in_progress`), and dates ISO rules.
4. **Router Node**:
   - IF valid ➡️ Escalate to Django's persistence layer for Upsert mappings.
   - IF invalid ➡️ Bounce back to Pipeline Mapper recursively.
   - IF Attempt cutoff (>3x) ➡️ Banish to the manual Django Dead Letter Queue API.

---

## 📂 Project Structure Map

```text
.
├── backend/                  # Django monolith orchestrator
│   ├── manage.py
│   ├── config/               # Settings & URL configuration
│   ├── events/               # Routing webhook JSON payloads natively
│   ├── tickets/              # Unified normalized storage models
│   ├── sync/                 # Cursor management models
│   └── integrations/         # Tool API Key authorizations
│
├── agent-service/            # Statelss FastAPI engine
│   ├── src/main.py           # Uvicorn boot
│   ├── src/agents/           # Orchestrator & LangGraph nodes
│   ├── src/schemas.py        # Strict Pydantic validations
│   └── tests/                # 93%+ Pytest branch coverage suites
│
├── mcp-servers/              # Model Context Protocol plugins
│   ├── jira/
│   ├── slack/
│   └── hubspot/
│
├── frontend/                 # Vite + React + TS operator console
│   ├── src/api/              # Typed Axios client + one module per /api/v1 group
│   ├── src/context/          # Auth provider (JWT + refresh rotation)
│   ├── src/components/       # App shell (Layout, ProtectedRoute) + UI primitives
│   ├── src/pages/            # One page per resource group, plus /agent (VoxBridge)
│   └── .env.example          # VITE_API_URL / VITE_AGENT_URL template
│
├── docker-compose.yml        # PostgreSQL & Redis clusters
├── Makefile                  # UV CLI standardized commands
└── .env.example              # Secret template requirements
```

---

## 🚀 Getting Started

### 1. System Requirements
- Docker & Docker Compose
- Ollama runtime logic engine installed natively
- `uv` Python workspace orchestrator

### 2. Local AI Setup
Pull the primary instruction model. We utilize standard models to adhere strictly into typed JSON endpoints natively.
```bash
ollama pull llama3:8b
```

### 3. Environment Config
Ensure you configure the root `.env` to route traffic into the local Ollama node context space:
```ini
OPENAI_API_KEY="ollama"
OPENAI_API_BASE_URL="http://127.0.0.1:11434/v1"
LLM_MODEL="llama3:8b"
LLM_TEMPERATURE=0.0
```

*(Ensure PostgreSQL/JWT variables are correctly patched mirroring `.env.example`)*

The frontend reads its own two variables from `frontend/.env` (copy `frontend/.env.example`):
```ini
# Django REST base, must include /api/v1
VITE_API_URL=http://localhost:8000/api/v1

# FastAPI agent service (used only by the /agent voice screen)
VITE_AGENT_URL=http://localhost:8001
```

### 4. Bootstrapping Local Infrastructure
Provision the backend systems.
```bash
docker-compose up -d
```

### 5. Running the Application Cluster
To guarantee environment isolation, we utilize mapped Make commands via `uv`.

**(Terminal 1) Workspace Orchestration & Environment Initialization**:
First, install all monorepo dependencies into a centrally routed `.venv`.
```bash
make setup
make install
```

**(Terminal 2) Django Management Base**:
Boot the REST interfaces, prepare the primary database schemas, and create the admin identity.
```bash
cd backend
../.venv/bin/python manage.py makemigrations
../.venv/bin/python manage.py migrate

# Optional: Create a superuser for the graphical Django Admin interface
../.venv/bin/python manage.py createsuperuser

# Start the REST API host
../.venv/bin/python manage.py runserver
```

**(Terminal 3) FastAPI LangGraph Agent**:
The core AI orchestration node processes pipeline actions securely.
```bash
make agent
```

**(Terminal 4 & 5) Celery Asynchronous Workers**:
These are absolutely crucial for processing webhook/Long-Running HTTP queries without crashing the web layer.
```bash
# Terminal 4: Start the base Celery background consumer
make celery-worker

# Terminal 5: Start the cron-job heartbeat scheduler
make celery-beat
```

**(Terminal 6) Frontend Dev Server**:
Boot the operator console. On first run it will install npm packages into `frontend/node_modules`.
```bash
# One-time setup (also covered by `make setup`)
cd frontend && npm install && cp .env.example .env

# Hot-reloading dev server on http://localhost:5173
make frontend
```

**One-shot full stack (`make dev`)** — starts Postgres + Redis via Docker, runs migrations, purges stale Celery queues, runs the full test suite, then launches Django (:8000), FastAPI (:8001), Celery worker + beat, and Vite (:5173) in parallel with labelled logs. **Free ports 8000, 8001, and 5173 first** (stop any previous `runserver`, `uvicorn`, or `vite`). On WSL, the frontend script invokes Vite through `node` so the `vite` CLI is never executed without `+x` on `node_modules/.bin`.

```bash
make dev
```

---

## 🧪 Testing Coverage & Linting
Our standardized CI/CD pipelines require total formatting alignment.
```bash
# Evaluate tests inside the LangGraph states
make test-agent

# Format via Ruff/Black standards globally
make fl

# Frontend static checks (typecheck + ESLint)
make frontend-typecheck
make frontend-lint
```

## 📚 Endpoints Overview
View the `api_reference.md` document artifact for a complete functional catalog tracing the specific interactions defining the frontend capabilities cross-infrastructure.
