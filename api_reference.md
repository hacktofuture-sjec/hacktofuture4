# Backend API Reference

This document outlines the purpose of all APIs declared in the Django backend. All operational endpoints are prefixed with `/api/v1/`.

> [!NOTE]
> Standard REST methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) apply to their respective List and Detail routes unless specified otherwise. Internal Agent endpoints like `/api/v1/events/ingest` and `/api/v1/tickets/upsert` require an `ApiKey` Authorization header rather than JWT auth.

### 🔐 Auth & Identity (`accounts.urls`)
Manages organizations, role-based access control, user sessions, and invites.
- `POST /api/v1/auth/register/` - Register a new user into the platform.
- `POST /api/v1/auth/login/` - Authenticate and retrieve JWT access & refresh tokens.
- `POST /api/v1/auth/logout/` - Invalidate standard user session tokens.
- `POST /api/v1/auth/refresh/` - Refresh expired JWT tokens.
- `GET /api/v1/auth/me/` - Fetch the authenticated user's profile and organization access parameters.
- `GET / PUT /api/v1/auth/organizations/<id>/` - Fetch or edit details for an Organization (tenant).
- `GET / POST /api/v1/auth/organizations/<org_id>/members/` - List users or assign members to an Organization.
- `GET / POST /api/v1/auth/organizations/<org_id>/invites/` - Generate invite links to onboard team members securely.
- `POST /api/v1/auth/organizations/<org_id>/invites/<token>/accept/` - Accept a pending secure invitation.
- `GET /api/v1/auth/roles/` - List available RBAC roles (Admin, Editor, Viewer).

### 📥 Ingestion & DLQ (`events.urls`)
Handles incoming webhooks, raw event-sourcing JSON payloads, and retries.
- `POST /api/v1/events/ingest` - Internal API: Receives webhook payloads or sync drops, queues them via Celery to the LangGraph pipeline, and writes to Data Lake.
- `GET /api/v1/events/` - List all unmodified JSONB payloads gathered via the sync engines.
- `GET /api/v1/events/<pk>/` - Specific payload raw event data.
- `POST /api/v1/dlq` - Internal API: Marks an event as failed after 3 LangGraph retries and appends validation traces.
- `GET /api/v1/dlq/` - View the Dead Letter Queue for broken or incompatible records.
- `POST /api/v1/dlq/<pk>/retry/` - Manually requeue a failed event from the interface.

### 🤖 Core Ticket Management (`tickets.urls`)
Stores AI-normalized versions of tickets mapped independently from their providers (e.g. Jira tasks).
- `POST /api/v1/tickets/upsert` - Internal API: Receives the strictly validated JSON from LangGraph and commits the `UnifiedTicket` to Postgres using idempotency constraints.
- `GET /api/v1/tickets/` - Retrieve normalized, cross-provider tickets for the frontend dashboards.
- `GET /api/v1/tickets/<pk>/` - Details of a single Unified Ticket.
- `GET /api/v1/tickets/<ticket_id>/activities/` - Audit trails or sub-events associated with a ticket.
- `GET /api/v1/tickets/<ticket_id>/comments/` - Standardized cross-provider comment array.
- `GET /api/v1/identities/map` - Internal API: Helper route mapping external platform User IDs to local Identity models.

### 🗂️ Integrations & Sync Workers (`integrations.urls`)
Configures the connection tokens to target tooling.
- `GET /api/v1/integrations/` - List natively supported providers (Jira, HubSpot, Slack, Linear).
- `GET /api/v1/integrations/<pk>/` - Provider capabilities overview.
- `GET / POST /api/v1/integrations/<id>/accounts/` - Provide OAuth payload config/API keys to sync an organization's specific tool.
- `POST /api/v1/integrations/<id>/accounts/<account_id>/sync/` - Manually trigger an on-demand sync cycle.

### 💬 Chat Interface (`chat.urls`)
REST architecture for AI-assisted queries and conversational states (LangChain history).
- `GET / POST /api/v1/chat/sessions/` - Retrieve past user chatting sessions or initialize a new conversation instance.
- `GET / DELETE /api/v1/chat/sessions/<pk>/` - Session configurations.
- `GET /api/v1/chat/sessions/<id>/messages/` - Retrieve conversation history for the context window.
- `POST /api/v1/chat/sessions/<id>/send/` - Route a prompt to the AI. Handles Server-Sent Event (SSE) execution responses or autonomous tool pipelines.

### 📊 AI Processing Observability (`processing.urls`)
Observability suite specifically designed to track the multi-step transitions of LangGraph.
- `GET /api/v1/processing/runs/` - List high-level LangGraph pipeline executions.
- `GET /api/v1/processing/runs/<pk>/` - Specific parameters and status payload of a run.
- `GET /api/v1/processing/runs/<id>/steps/` - View the exact node transitions (e.g., Mapper → Validator → Retry) logged internally for debugging.

### 📈 Dashboards & Insights (`insights.urls`)
Exposes widgets and data rendering outputs.
- `GET /api/v1/insights/` - Retrieve generative insights summarized periodically across the Organization.
- `GET / POST /api/v1/dashboards/` - Custom GUI component containers mapped to users/orgs.
- `GET / PUT /api/v1/dashboards/<pk>/` - Modify dashboard grids/parameters.
- `GET /api/v1/dashboards/<id>/widgets/` - Fetch widget components rendering Chart.js or React parameters.
- `GET /api/v1/saved-queries/` - Retrieve complex query logic/filters backing the metrics.

### 💂 Security & Infrastructure
API keys and logs for internal systems.
- `GET / POST /api/v1/security/api-keys/` - Provision or retrieve API Keys mapping to Service Accounts natively utilized by the FastAPI Agent to bypass standard JWT configurations.
- `DELETE /api/v1/security/api-keys/<pk>/` - Perform key rotation or system revocation.
- `GET /api/v1/security/audit-logs/` - Return comprehensive audit trails respecting RBAC parameters.
- `GET /api/v1/sync/checkpoints/` - Return paginated tracking cursors (`last_synced_time`) to prevent infinite incremental looping on Jira/Hubspot API syncs.
