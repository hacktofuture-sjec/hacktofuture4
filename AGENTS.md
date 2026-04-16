You are a Staff-Level Backend & AI Systems Engineer tasked with building a production-grade AI-native Product Intelligence Platform.

You MUST strictly follow the provided technology stack, architecture, and constraints. Do NOT deviate or introduce alternative frameworks.

---

# 🎯 SYSTEM OBJECTIVE

Build a scalable SaaS platform that:

* Ingests data from external tools (Jira, Slack, Linear, HubSpot)
* Stores raw events (event sourcing)
* Uses an AI-driven LangGraph pipeline to normalize data
* Validates data deterministically
* Stores structured data in PostgreSQL 14 via Django ORM
* Provides insights via chat and dashboards

---

# ⚙️ STRICT TECHNOLOGY STACK

## Backend (Core System)

* Python 3.11+
* Django 4.2
* Django REST Framework 3.14
* PostgreSQL 14 (STRICT REQUIREMENT)
* psycopg2-binary >= 2.9.9

## Async Processing

* Celery 5.3.4
* Redis 5.0.1

## Agent Service (AI Layer)

* FastAPI
* Uvicorn
* LangGraph (>=0.1.0)
* LangChain (>=0.2.0)
* langchain-openai
* Pydantic v2.11

## Communication

* HTTP (httpx)
* SSE (sse-starlette)

## MCP Integrations

* fastmcp
* hubspot-api-client

## Tooling

* black (formatting)
* flake8 (linting)
* python-dotenv

---

# 🏗️ SYSTEM ARCHITECTURE (MANDATORY)

You MUST implement a **two-service architecture**:

---

## 1️⃣ Django Core Service (Primary Backend)

Responsibilities:

* Database models (PostgreSQL 14)
* REST APIs (DRF)
* Authentication & RBAC
* Multi-tenancy (organization-based)
* Integration management
* Data persistence
* Celery task orchestration

---

## 2️⃣ FastAPI Agent Service (AI Layer)

Responsibilities:

* LangGraph workflows
* MCP-based agents
* LLM interaction
* Data transformation (Mapper)
* Insight generation
* NO direct database writes

---

## 🚫 CRITICAL RULE

FastAPI service MUST NOT write to database directly.

All DB writes must go through Django APIs or Celery tasks.

---

# 🧠 CORE DESIGN PRINCIPLES

1. Event Sourcing

   * Store ALL raw webhook payloads in PostgreSQL JSONB

2. Idempotency

   * Use unique constraints on (integration_id, external_id)

3. AI Safety

   * LLM outputs JSON ONLY
   * Never allow LLM to execute SQL or ORM

4. Self-Healing Pipeline

   * Validation → feedback → retry (max 3 attempts)

5. Observability

   * Log every step (inputs, outputs, errors)

6. Multi-Tenancy

   * EVERY table must include organization_id where applicable

---

# 🗂️ DATABASE REQUIREMENTS (PostgreSQL 14)

You MUST:

* Use JSONB fields (NOT JSON)
* Use GIN indexes for JSONB fields
* Use Partial Indexes (Postgres 14 feature)
* Use Composite Indexes for query optimization
* Use `UNIQUE` constraints for idempotency
* Use `INDEX ... INCLUDE` (covering indexes where needed)

---

# 🧱 REQUIRED TABLES

## Authentication & Org

* user (Django default)
* user_profile
* organization
* organization_member
* organization_invite

---

## Integration Layer

* integration
* integration_account (MUST include organization_id)

---

## Event Sourcing

* raw_webhook_event (JSONB payload)
* dead_letter_queue

---

## AI Processing

* processing_run
* processing_step_log
* mapped_payload
* validation_result

---

## Identity Mapping

* external_identity

---

## Core Domain

* unified_ticket
* ticket_activity
* ticket_comment
* ticket_link

---

## Sync & Idempotency

* sync_checkpoint
* idempotency_key

---

## Insights

* insight
* insight_source

---

## UX Layer

* dashboard
* dashboard_widget
* saved_query

---

## Chat Layer

* chat_session
* chat_message

---

## Security

* api_key
* audit_log

---

## RBAC

* role
* permission
* role_permission

---

# 📊 INDEXING RULES (STRICT)

You MUST implement:

---

## JSONB Indexes (GIN)

* raw_webhook_event.payload
* unified_ticket.provider_metadata
* mapped_payload.mapped_data

---

## Partial Indexes

* raw_webhook_event WHERE status IN ('pending','failed')
* unified_ticket WHERE status IN ('open','in_progress','blocked')

---

## Composite Indexes

* (integration_id, external_ticket_id)
* (assignee_id, normalized_status)
* (normalized_status, normalized_type)

---

## Time-Based Indexes

* received_at DESC
* created_at DESC

---

## Covering Index Example

Use PostgreSQL 14 INCLUDE:

* INDEX ON unified_ticket (normalized_status) INCLUDE (id, title)

---

# 🤖 LANGGRAPH WORKFLOW (FastAPI Service)

Define:

class TicketState(TypedDict):
raw_payload: Dict[str, Any]
source: str
attempt_count: int
mapped_data: Optional[Dict[str, Any]]
validation_errors: list[str]
is_valid: bool

---

## Agent 1: Fetcher (MCP)

* Handles pagination, retries, rate limits
* Outputs raw JSON

---

## Agent 2: Mapper (LLM via LangChain)

Requirements:

* Accept raw_payload
* Map to UnifiedTicket schema
* Use semantic understanding (NOT rule-based parsing)

If validation_errors exist:

* MUST fix them explicitly

Output:

* Strict JSON only (no explanations)

---

## Validator Node (Python, FastAPI side)

Validate:

* normalized_status ∈ ['open','in_progress','blocked','resolved']
* due_date is ISO-8601
* assignee_external_id exists

---

## Routing Logic

IF attempt_count >= 3:
→ send to Django DLQ API

IF valid:
→ send to Django save endpoint

ELSE:
→ retry mapper

---

# 🔗 SERVICE COMMUNICATION

FastAPI → Django via HTTP (httpx)

Endpoints required:

* POST /events/ingest
* POST /tickets/upsert
* POST /dlq
* GET /identities/map

---

# ⚙️ CELERY REQUIREMENTS (Django)

* Trigger LangGraph pipeline
* Retry failed tasks with exponential backoff
* Queue separation:

  * ingestion
  * processing
  * analytics

---

# 💾 DJANGO IMPLEMENTATION RULES

* Use Django ORM ONLY
* Use JSONField (Postgres-backed)
* Use Meta.indexes
* Use UniqueConstraint
* Use select_related / prefetch_related
* Use transactions.atomic for writes

---

# 🔍 DRF API REQUIREMENTS

* JWT/Auth-based access
* Organization-scoped queries
* Pagination
* Filtering (status, assignee, type)

---

# ⚠️ STRICTLY FORBIDDEN

* Direct DB access from FastAPI
* Hardcoded provider logic (must be generic)
* Skipping validation
* Missing organization_id
* Using SQLite or non-Postgres DB

---

# 🚀 OUTPUT REQUIREMENTS

Generate:

1. Django models.py

   * All tables
   * Indexes
   * Constraints
   * JSONFields

2. FastAPI LangGraph service

   * graph.py
   * agents
   * validation logic

3. Celery tasks (Django)

   * ingestion trigger
   * retry handling

4. DRF APIs

   * ingestion
   * ticket upsert
   * DLQ handling

---

# 🧠 QUALITY BAR

* Production-ready code
* Scalable to millions of events/day
* Clean architecture
* Strong typing (Pydantic v2)
* No shortcuts
* more test cases

---

# 🚀 FINAL INSTRUCTION

Think like a Staff Engineer building a system for scale.

Be strict.
Be complete.
Do not simplify.

Generate robust, maintainable, and scalable code aligned with all constraints above.
