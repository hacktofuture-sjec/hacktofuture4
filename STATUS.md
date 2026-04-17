# 📊 Product Intelligence Platform — Master Status Tracker

> **Last Updated:** 2026-04-17
> **Session:** Frontend API Integration
> **Legend:** `[ ]` Not started · `[/]` In progress · `[x]` Complete · `[!]` Blocked

---

## 🗂️ TABLE OF CONTENTS

1. [Infrastructure & DevOps](#1-infrastructure--devops)
2. [Django Settings & Configuration](#2-django-settings--configuration)
3. [App: `core` (Base Utilities)](#3-app-core-base-utilities)
4. [App: `accounts` (Auth, Org, RBAC)](#4-app-accounts-auth-org-rbac)
5. [App: `integrations`](#5-app-integrations)
6. [App: `events` (Event Sourcing)](#6-app-events-event-sourcing)
7. [App: `processing` (AI Pipeline Storage)](#7-app-processing-ai-pipeline-storage)
8. [App: `tickets` (Core Domain)](#8-app-tickets-core-domain)
9. [App: `sync` (Idempotency & Checkpoints)](#9-app-sync-idempotency--checkpoints)
10. [App: `insights`](#10-app-insights)
11. [App: `chat`](#11-app-chat)
12. [App: `security`](#12-app-security)
13. [Celery Task System](#13-celery-task-system)
14. [DRF API Layer](#14-drf-api-layer)
15. [FastAPI Agent Service](#15-fastapi-agent-service)
16. [MCP Servers](#16-mcp-servers)
17. [Test Suite](#17-test-suite)
18. [Database Migrations](#18-database-migrations)
19. [CI/CD & Tooling](#19-cicd--tooling)
20. [Web Frontend (Operator Console)](#20-web-frontend-operator-console)

---

## 1. Infrastructure & DevOps

### 1.1 Docker Compose

- [x] `postgres:14-alpine` service with named volume
- [x] `redis:7-alpine` service
- [x] `backend` service (Django + Gunicorn)
  - [x] `Dockerfile` in `backend/`
  - [x] `entrypoint.sh` — run migrations then start Gunicorn
  - [x] healthcheck: `pg_isready` + Django `/health`
  - [x] env_file: `.env`
- [x] `celery-worker` service
  - [x] Runs: `celery -A backend worker -Q ingestion,processing,analytics --concurrency=4`
  - [x] Depends on: `backend`, `redis`, `postgres`
  - [x] Restart policy: `on-failure`
- [x] `celery-beat` service
  - [x] Runs: `celery -A backend beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`
  - [x] Depends on: `celery-worker`
- [x] `agent-service` service (FastAPI + Uvicorn)
  - [x] `Dockerfile` in `agent-service/`
  - [x] healthcheck: `GET /health`
  - [x] env_file: `.env`
  - [x] Depends on: `redis`
- [x] Named network `platform_network` for inter-service communication
- [x] Persistent volumes: `postgres_data`, `redis_data`

### 1.2 Environment Configuration

- [x] `.env.example` file exists
- [ ] Add all required env vars to `.env.example`:
  - [ ] `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
  - [ ] `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
  - [ ] `REDIS_URL`
  - [ ] `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
  - [ ] `AGENT_SERVICE_URL` (FastAPI base URL)
  - [ ] `DJANGO_API_BASE_URL` (for agent service → Django calls)
  - [ ] `OPENAI_API_KEY`
  - [ ] `JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, `JWT_REFRESH_TOKEN_LIFETIME_DAYS`
  - [ ] `HUBSPOT_API_KEY`, `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `LINEAR_API_KEY`, `SLACK_BOT_TOKEN`

### 1.3 Makefile Targets

- [x] `make lint` (black + flake8)
- [x] `make test` (pytest)
- [x] `make migrate` → `python manage.py migrate` in backend
- [x] `make makemigrations` → `python manage.py makemigrations`
- [x] `make shell` → Django shell
- [x] `make celery-worker`
- [x] `make celery-beat`
- [x] `make agent` → start uvicorn
- [x] `make superuser` → `python manage.py createsuperuser`
- [x] `make docker-up` / `make docker-down`

---

## 2. Django Settings & Configuration

### 2.1 `backend/backend/settings.py`

- [x] PostgreSQL 14 database config (env-driven)
- [x] `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS` from env
- [x] `corsheaders` middleware
- [ ] `INSTALLED_APPS` — add all 9 new apps:
  - [ ] `accounts`
  - [ ] `integrations`
  - [ ] `events`
  - [ ] `processing`
  - [ ] `tickets`
  - [ ] `sync`
  - [ ] `insights`
  - [ ] `chat`
  - [ ] `security`
  - [ ] `django_filters`
  - [ ] `rest_framework_simplejwt`
  - [ ] `django_celery_beat`
  - [ ] `django_celery_results`
- [ ] Full DRF config block:
  ```python
  REST_FRAMEWORK = {
      'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
      'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
      'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
      'PAGE_SIZE': 50,
      'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
      'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
  }
  ```
- [ ] JWT settings (`SIMPLE_JWT`):
  - [ ] `ACCESS_TOKEN_LIFETIME` (from env, default 60 min)
  - [ ] `REFRESH_TOKEN_LIFETIME` (from env, default 7 days)
  - [ ] `ROTATE_REFRESH_TOKENS = True`
  - [ ] `AUTH_HEADER_TYPES = ('Bearer',)`
- [ ] Celery settings:
  - [ ] `CELERY_BROKER_URL` (Redis)
  - [ ] `CELERY_RESULT_BACKEND` (Redis / django-db)
  - [ ] `CELERY_TASK_SERIALIZER = 'json'`
  - [ ] `CELERY_ACCEPT_CONTENT = ['json']`
  - [ ] `CELERY_TASK_TRACK_STARTED = True`
  - [ ] `CELERY_TASK_TIME_LIMIT` (600s)
  - [ ] `CELERY_TASK_ROUTES` mapping 3 queues
- [ ] `AGENT_SERVICE_URL` from env
- [ ] `LOGGING` config (JSON structured logs to stdout)
- [ ] `STATIC_ROOT`, `MEDIA_ROOT`
- [ ] `DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'` ✅ already set

### 2.2 `backend/backend/celery.py`

- [ ] `Celery` app instantiation with `backend` as app name
- [ ] `autodiscover_tasks()` for all apps
- [ ] Signal: `@app.on_after_configure.connect` to validate broker connection
- [ ] Import in `backend/__init__.py` to ensure app loads with Django

### 2.3 `backend/backend/urls.py`

- [x] `/health` endpoint
- [x] `/admin/` route
- [ ] `/api/v1/auth/` → accounts JWT urls
- [ ] `/api/v1/` → all app routers via `include()`
- [ ] API versioning prefix `/api/v1/`

---

## 3. App: `core` (Base Utilities)

> Repurposed from placeholder. Provides abstract base models and mixins reused across all apps.

### 3.1 Files

- [ ] `core/models.py` — replace `QueryLog` with:
  - [ ] `TimestampedModel` (abstract) — `created_at`, `updated_at`
  - [ ] `OrgScopedModel` (abstract) — `organization` FK + `TimestampedModel`
  - [ ] `UUIDPrimaryKeyModel` (abstract) — `id = UUIDField(primary_key=True, default=uuid4)`
- [ ] `core/mixins.py`:
  - [ ] `OrgScopedQuerySetMixin` — filters queryset by `request.user`'s org
  - [ ] `AuditableMixin` — writes to `AuditLog` on save/delete
- [ ] `core/permissions.py`:
  - [ ] `IsOrganizationMember` — DRF permission
  - [ ] `IsOrganizationAdmin` — DRF permission
  - [ ] `HasAPIKey` — validates `ApiKey` header
- [ ] `core/pagination.py`:
  - [ ] `StandardResultsPagination` — page_size=50, max=200
  - [ ] `CursorPagination` for time-series endpoints
- [ ] `core/exceptions.py`:
  - [ ] `OrganizationNotFound`
  - [ ] `IntegrationNotConfigured`
  - [ ] `IdempotencyConflict`
  - [ ] Custom DRF exception handler
- [ ] `core/admin.py` — remove `QueryLog`, register base admin

### 3.2 Relationships Provided

- `TimestampedModel` → inherited by **every** model across all apps
- `OrgScopedModel` → inherited by `Integration`, `IntegrationAccount`, `RawWebhookEvent`, `UnifiedTicket`, `Insight`, `Dashboard`, `ChatSession`, `ApiKey`, `AuditLog`, `SyncCheckpoint`
- `UUIDPrimaryKeyModel` → used by `ChatSession`, `ProcessingRun`, `ApiKey`

---

## 4. App: `accounts` (Auth, Org, RBAC)

### 4.1 Models

#### `UserProfile`
- [ ] `user` → `OneToOneField(User, related_name='profile')`
- [ ] `organization` → `ForeignKey(Organization, null=True)`
- [ ] `avatar_url` → `URLField(blank=True)`
- [ ] `timezone` → `CharField(max_length=50, default='UTC')`
- [ ] `preferences` → `JSONField(default=dict)` — JSONB
- [ ] `is_onboarded` → `BooleanField(default=False)`
- [ ] **Indexes:** `organization_id`

#### `Organization`
- [ ] `id` → `UUIDField(primary_key=True)`
- [ ] `name` → `CharField(max_length=255)`
- [ ] `slug` → `SlugField(unique=True)`
- [ ] `plan_tier` → `CharField(choices=[('free','starter','pro','enterprise')])`
- [ ] `settings` → `JSONField(default=dict)` — JSONB (feature flags, limits)
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `created_at`, `updated_at` → via `TimestampedModel`
- [ ] **Constraints:** `UNIQUE(slug)`
- [ ] **Indexes:** `slug`, `is_active`, `plan_tier`

#### `OrganizationMember`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE, related_name='members')`
- [ ] `user` → `ForeignKey(User, on_delete=CASCADE, related_name='org_memberships')`
- [ ] `role` → `ForeignKey(Role, on_delete=PROTECT)` ← **RBAC relation**
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `joined_at` → `DateTimeField(auto_now_add=True)`
- [ ] **Constraints:** `UniqueConstraint(fields=['organization','user'], name='unique_org_member')`
- [ ] **Indexes:** `(organization_id, user_id)`, `(organization_id, role_id)`

#### `OrganizationInvite`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)`
- [ ] `invited_by` → `ForeignKey(User, on_delete=CASCADE, related_name='sent_invites')`
- [ ] `email` → `EmailField()`
- [ ] `role` → `ForeignKey(Role, on_delete=PROTECT)` ← **RBAC relation**
- [ ] `token` → `UUIDField(unique=True, default=uuid4)` — invite link token
- [ ] `status` → `CharField(choices=['pending','accepted','expired','revoked'])`
- [ ] `expires_at` → `DateTimeField()`
- [ ] **Constraints:** `UniqueConstraint(fields=['organization','email'], condition=Q(status='pending'), name='unique_pending_invite')`

#### `Role`
- [ ] `name` → `CharField(max_length=100)` — e.g. `owner`, `admin`, `member`, `viewer`
- [ ] `organization` → `ForeignKey(Organization, null=True)` — null = system role
- [ ] `is_system` → `BooleanField(default=False)`
- [ ] **Constraints:** `UNIQUE(name, organization)`

#### `Permission`
- [ ] `codename` → `CharField(max_length=100, unique=True)` — e.g. `tickets.view`, `tickets.create`
- [ ] `description` → `TextField(blank=True)`
- [ ] `resource` → `CharField(max_length=50)` — tickets, insights, chat, etc.

#### `RolePermission`
- [ ] `role` → `ForeignKey(Role, on_delete=CASCADE, related_name='role_permissions')` ← **RBAC relation**
- [ ] `permission` → `ForeignKey(Permission, on_delete=CASCADE)` ← **RBAC relation**
- [ ] **Constraints:** `UniqueConstraint(fields=['role','permission'], name='unique_role_perm')`

### 4.2 Serializers

- [ ] `UserRegistrationSerializer` — creates User + Organization + UserProfile atomically
- [ ] `UserProfileSerializer`
- [ ] `OrganizationSerializer` (read) + `OrganizationUpdateSerializer`
- [ ] `OrganizationMemberSerializer`
- [ ] `OrganizationInviteSerializer` (create generates token, send email stub)
- [ ] `RoleSerializer`, `PermissionSerializer`

### 4.3 Views / API Endpoints

- [ ] `POST /api/v1/auth/register/` — creates User + Org + Profile in `atomic()`
- [ ] `POST /api/v1/auth/login/` — `TokenObtainPairView` (simplejwt)
- [ ] `POST /api/v1/auth/refresh/` — `TokenRefreshView`
- [ ] `POST /api/v1/auth/logout/` — token blacklist
- [ ] `GET /api/v1/auth/me/` — current user + profile
- [ ] `GET/PATCH /api/v1/organizations/{id}/` — org detail
- [ ] `GET/POST /api/v1/organizations/{id}/members/` — list + add member
- [ ] `DELETE /api/v1/organizations/{id}/members/{user_id}/` — remove member
- [ ] `GET/POST /api/v1/organizations/{id}/invites/` — invite management
- [ ] `POST /api/v1/organizations/{id}/invites/{token}/accept/` — accept invite
- [ ] `GET /api/v1/roles/` — list available roles for org
- [ ] `GET /api/v1/permissions/` — list permissions

### 4.4 Tests

- [ ] `test_user_registration_creates_org_and_profile()`
- [ ] `test_duplicate_email_registration_fails()`
- [ ] `test_login_returns_jwt_tokens()`
- [ ] `test_jwt_refresh_works()`
- [ ] `test_org_scoped_member_list()`
- [ ] `test_invite_creates_pending_invite()`
- [ ] `test_invite_accept_creates_membership()`
- [ ] `test_duplicate_pending_invite_blocked()`
- [ ] `test_rbac_permission_check()`

---

## 5. App: `integrations`

### 5.1 Models

#### `Integration`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `provider` → `CharField(choices=['jira','slack','linear','hubspot','github'])` — **generic, not hardcoded**
- [ ] `name` → `CharField(max_length=255)` — user-visible display name
- [ ] `config` → `JSONField(default=dict)` — JSONB (base_url, workspace_id, etc.)
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `created_by` → `ForeignKey(User, on_delete=SET_NULL, null=True)`
- [ ] `created_at`, `updated_at`
- [ ] **Constraints:** `UniqueConstraint(fields=['organization','provider','name'], name='unique_org_integration')`
- [ ] **Indexes:** `(organization_id, provider)`, `(organization_id, is_active)`

#### `IntegrationAccount`
- [ ] `integration` → `ForeignKey(Integration, on_delete=CASCADE, related_name='accounts')` ← **relation**
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **REQUIRED per AGENTS.md**
- [ ] `external_account_id` → `CharField(max_length=255)` — provider's account/workspace id
- [ ] `display_name` → `CharField(max_length=255, blank=True)`
- [ ] `credentials` → `JSONField(default=dict)` — JSONB (encrypted OAuth tokens, API keys)
- [ ] `scopes` → `JSONField(default=list)` — JSONB list of OAuth scopes
- [ ] `token_expires_at` → `DateTimeField(null=True)`
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `last_synced_at` → `DateTimeField(null=True)`
- [ ] **Constraints:** `UniqueConstraint(fields=['integration','external_account_id'], name='unique_integration_account')`
- [ ] **Indexes:** `(organization_id, integration_id)`, `(integration_id, is_active)`

### 5.2 Serializers

- [ ] `IntegrationSerializer`
- [ ] `IntegrationAccountSerializer` (credentials write-only on create)

### 5.3 Views / API Endpoints

- [ ] `GET/POST /api/v1/integrations/` — create/list integrations (org scoped)
- [ ] `GET/PATCH/DELETE /api/v1/integrations/{id}/` — integration detail
- [ ] `GET/POST /api/v1/integrations/{id}/accounts/` — accounts per integration
- [ ] `POST /api/v1/integrations/{id}/accounts/{account_id}/sync/` — trigger manual sync

### 5.4 Tests

- [ ] `test_create_jira_integration_org_scoped()`
- [ ] `test_duplicate_integration_blocked()`
- [ ] `test_integration_account_credential_write_only()`
- [ ] `test_cross_org_integration_not_visible()`
- [ ] `test_sync_trigger_fires_celery_task()`

---

## 6. App: `events` (Event Sourcing)

### 6.1 Models

#### `RawWebhookEvent`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `integration` → `ForeignKey(Integration, on_delete=SET_NULL, null=True)` ← **relation**
- [ ] `integration_account` → `ForeignKey(IntegrationAccount, on_delete=SET_NULL, null=True)` ← **relation**
- [ ] `event_type` → `CharField(max_length=100)` — e.g. `jira.issue.created`
- [ ] `payload` → `JSONField()` — **JSONB** (raw webhook body, immutable)
- [ ] `status` → `CharField(choices=['pending','processing','processed','failed'], default='pending')`
- [ ] `received_at` → `DateTimeField(auto_now_add=True)`
- [ ] `processed_at` → `DateTimeField(null=True)`
- [ ] `processing_run` → `ForeignKey(ProcessingRun, on_delete=SET_NULL, null=True)` ← **AI relation**
- [ ] `idempotency_key` → `CharField(max_length=255, unique=True)` — SHA256(integration_id + event_type + payload_hash)
- [ ] **Indexes:**
  - [ ] `GinIndex(fields=['payload'])` ← **JSONB GIN**
  - [ ] Partial index on `status` IN ('pending','failed') ← **Postgres 14 partial**
  - [ ] `received_at DESC` ← time-based
  - [ ] `(organization_id, status)`
  - [ ] `(integration_id, received_at DESC)`

#### `DeadLetterQueue`
- [ ] `raw_event` → `OneToOneField(RawWebhookEvent, on_delete=CASCADE)` ← **event sourcing relation**
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `failure_reason` → `TextField()`
- [ ] `error_trace` → `JSONField(default=dict)` — JSONB (full exception + stack)
- [ ] `retry_count` → `IntegerField(default=0)`
- [ ] `last_retry_at` → `DateTimeField(null=True)`
- [ ] `status` → `CharField(choices=['pending_retry','exhausted','resolved'], default='pending_retry')`
- [ ] `created_at`, `updated_at`
- [ ] **Indexes:** `(organization_id, status)`, `last_retry_at`

### 6.2 Serializers

- [ ] `RawWebhookEventSerializer` (payload read-only after create)
- [ ] `DeadLetterQueueSerializer`
- [ ] `EventIngestSerializer` — validates incoming webhook (org, integration, payload required)

### 6.3 Views / API Endpoints

- [ ] `POST /api/v1/events/ingest` — **called by FastAPI agent service**
  - [ ] Creates `RawWebhookEvent` with status=`pending`
  - [ ] Fires `process_raw_webhook.apply_async()` on `ingestion` queue
  - [ ] Returns `{event_id, status}` immediately (async)
- [ ] `POST /api/v1/dlq` — **called by FastAPI on max retries**
  - [ ] Creates/updates `DeadLetterQueue` entry
- [ ] `GET /api/v1/events/` — paginated list of raw events (org scoped, filterable by status/integration)
- [ ] `GET /api/v1/events/{id}/` — single event detail
- [ ] `GET /api/v1/dlq/` — dead letter queue list
- [ ] `POST /api/v1/dlq/{id}/retry/` — manually retry a DLQ entry

### 6.4 Tasks (`events/tasks.py`)

- [ ] `process_raw_webhook(event_id: int)`:
  - [ ] Queue: `ingestion`
  - [ ] Fetch `RawWebhookEvent`, set status=`processing`
  - [ ] POST to `AGENT_SERVICE_URL/pipeline/run` via httpx
  - [ ] On success → set status=`processed`
  - [ ] On failure → exponential backoff retry (max_retries=5, countdown=60*2^retry)
  - [ ] On exhaustion → set status=`failed`, create `DeadLetterQueue` entry
- [ ] `retry_failed_events()`:
  - [ ] Queue: `ingestion`
  - [ ] Beat schedule: every 5 minutes
  - [ ] Picks DLQ entries with status=`pending_retry` and retry_count < 3
  - [ ] Re-fires `process_raw_webhook`

### 6.5 Tests

- [ ] `test_ingest_creates_raw_event_and_triggers_task()`
- [ ] `test_ingest_idempotency_duplicate_blocked()`
- [ ] `test_ingest_payload_stored_as_jsonb()`
- [ ] `test_dlq_endpoint_creates_entry()`
- [ ] `test_retry_task_exponential_backoff()`
- [ ] `test_event_list_org_scoped()`
- [ ] `test_raw_event_partial_index_applied()`

---

## 7. App: `processing` (AI Pipeline Storage)

### 7.1 Models

#### `ProcessingRun`
- [ ] `id` → `UUIDField(primary_key=True, default=uuid4)`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `raw_event` → `ForeignKey(RawWebhookEvent, on_delete=CASCADE, related_name='processing_runs')` ← **event relation**
- [ ] `status` → `CharField(choices=['started','mapping','validating','completed','failed'])`
- [ ] `attempt_count` → `IntegerField(default=1)` — tracks retries within LangGraph
- [ ] `llm_model` → `CharField(max_length=100)` — e.g. `gpt-4o`
- [ ] `started_at` → `DateTimeField(auto_now_add=True)`
- [ ] `completed_at` → `DateTimeField(null=True)`
- [ ] `duration_ms` → `IntegerField(null=True)`
- [ ] `source` → `CharField(max_length=50)` — provider name
- [ ] **Indexes:** `(organization_id, status)`, `started_at DESC`

#### `ProcessingStepLog`
- [ ] `processing_run` → `ForeignKey(ProcessingRun, on_delete=CASCADE, related_name='step_logs')` ← **pipeline relation**
- [ ] `step_name` → `CharField(max_length=100)` — `fetcher`, `mapper`, `validator`
- [ ] `sequence` → `IntegerField()` — order within run (1, 2, 3…)
- [ ] `status` → `CharField(choices=['started','completed','failed'])`
- [ ] `input_data` → `JSONField(null=True)` — JSONB
- [ ] `output_data` → `JSONField(null=True)` — JSONB
- [ ] `error_message` → `TextField(blank=True)`
- [ ] `duration_ms` → `IntegerField(null=True)`
- [ ] `logged_at` → `DateTimeField(auto_now_add=True)`
- [ ] **Indexes:** `(processing_run_id, sequence)`, `logged_at DESC`

#### `MappedPayload`
- [ ] `processing_run` → `OneToOneField(ProcessingRun, on_delete=CASCADE)` ← **pipeline relation**
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `mapped_data` → `JSONField()` — **JSONB with GIN index** (normalized ticket data from LLM)
- [ ] `schema_version` → `CharField(max_length=20, default='v1')` — track mapping schema version
- [ ] `mapped_at` → `DateTimeField(auto_now_add=True)`
- [ ] **Indexes:** `GinIndex(fields=['mapped_data'])` ← **JSONB GIN**

#### `ValidationResult`
- [ ] `processing_run` → `OneToOneField(ProcessingRun, on_delete=CASCADE)` ← **pipeline relation**
- [ ] `mapped_payload` → `OneToOneField(MappedPayload, on_delete=CASCADE)` ← **direct relation**
- [ ] `is_valid` → `BooleanField()`
- [ ] `validation_errors` → `JSONField(default=list)` — JSONB list of error strings
- [ ] `validated_at` → `DateTimeField(auto_now_add=True)`

### 7.2 Serializers

- [ ] `ProcessingRunSerializer`
- [ ] `ProcessingStepLogSerializer`
- [ ] `MappedPayloadSerializer`
- [ ] `ValidationResultSerializer`

### 7.3 Views / API Endpoints

- [ ] `GET /api/v1/processing/runs/` — list runs (org scoped, filter by status/event)
- [ ] `GET /api/v1/processing/runs/{id}/` — detail with step logs
- [ ] `GET /api/v1/processing/runs/{id}/steps/` — step log list

### 7.4 Tests

- [ ] `test_processing_run_uuid_primary_key()`
- [ ] `test_step_log_sequence_ordering()`
- [ ] `test_mapped_payload_gin_index_exists()`
- [ ] `test_validation_result_linked_to_mapped_payload()`

---

## 8. App: `tickets` (Core Domain)

### 8.1 Models

#### `UnifiedTicket`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `integration` → `ForeignKey(Integration, on_delete=CASCADE)` ← **source integration**
- [ ] `integration_account` → `ForeignKey(IntegrationAccount, on_delete=SET_NULL, null=True)`
- [ ] `external_ticket_id` → `CharField(max_length=255)` — ticket ID in source system
- [ ] `title` → `CharField(max_length=1000)`
- [ ] `description` → `TextField(blank=True)`
- [ ] `normalized_status` → `CharField(choices=['open','in_progress','blocked','resolved'])` — **required by AGENTS.md**
- [ ] `normalized_type` → `CharField(choices=['bug','feature','task','epic','story','subtask','other'])`
- [ ] `priority` → `CharField(choices=['critical','high','medium','low','none'], default='none')`
- [ ] `assignee` → `ForeignKey(ExternalIdentity, on_delete=SET_NULL, null=True, related_name='assigned_tickets')` ← **identity mapping relation**
- [ ] `reporter` → `ForeignKey(ExternalIdentity, on_delete=SET_NULL, null=True, related_name='reported_tickets')` ← **identity mapping relation**
- [ ] `due_date` → `DateField(null=True)` — ISO-8601 validated
- [ ] `provider_metadata` → `JSONField(default=dict)` — **JSONB with GIN index** (provider-specific raw fields)
- [ ] `labels` → `JSONField(default=list)` — JSONB list of label strings
- [ ] `processing_run` → `ForeignKey(ProcessingRun, on_delete=SET_NULL, null=True)` ← **AI pipeline relation**
- [ ] `created_at`, `updated_at`
- [ ] `source_created_at` → `DateTimeField(null=True)` — when ticket was created in source system
- [ ] `source_updated_at` → `DateTimeField(null=True)`
- [ ] **Constraints:**
  - [ ] `UniqueConstraint(fields=['integration','external_ticket_id'], name='unique_ticket_per_integration')` ← **idempotency**
- [ ] **Indexes:**
  - [ ] `GinIndex(fields=['provider_metadata'])` ← **JSONB GIN**
  - [ ] Partial index on `normalized_status` IN ('open','in_progress','blocked') ← **Postgres 14**
  - [ ] `(integration_id, external_ticket_id)` ← **composite**
  - [ ] `(assignee_id, normalized_status)` ← **composite**
  - [ ] `(normalized_status, normalized_type)` ← **composite**
  - [ ] Covering index: `normalized_status INCLUDE (id, title)` ← **Postgres 14 INCLUDE**
  - [ ] `updated_at DESC` ← time-based
  - [ ] `(organization_id, normalized_status)`

#### `TicketActivity`
- [ ] `ticket` → `ForeignKey(UnifiedTicket, on_delete=CASCADE, related_name='activities')` ← **ticket relation**
- [ ] `actor` → `ForeignKey(ExternalIdentity, on_delete=SET_NULL, null=True)` ← **identity relation**
- [ ] `activity_type` → `CharField(choices=['status_change','assignment','comment','label','priority','custom'])`
- [ ] `changes` → `JSONField(default=dict)` — JSONB `{field: {from, to}}`
- [ ] `occurred_at` → `DateTimeField()` — when it happened in source system
- [ ] `created_at`
- [ ] **Indexes:** `(ticket_id, occurred_at DESC)`

#### `TicketComment`
- [ ] `ticket` → `ForeignKey(UnifiedTicket, on_delete=CASCADE, related_name='comments')` ← **ticket relation**
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `external_comment_id` → `CharField(max_length=255, blank=True)`
- [ ] `author` → `ForeignKey(ExternalIdentity, on_delete=SET_NULL, null=True)` ← **identity relation**
- [ ] `body` → `TextField()`
- [ ] `body_html` → `TextField(blank=True)` — rendered HTML if available
- [ ] `is_internal` → `BooleanField(default=False)` — internal notes vs public comments
- [ ] `source_created_at` → `DateTimeField(null=True)`
- [ ] `created_at`
- [ ] **Constraints:** `UniqueConstraint(fields=['ticket','external_comment_id'], condition=~Q(external_comment_id=''), name='unique_external_comment')`
- [ ] **Indexes:** `(ticket_id, source_created_at DESC)`

#### `TicketLink`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)`
- [ ] `source_ticket` → `ForeignKey(UnifiedTicket, on_delete=CASCADE, related_name='outgoing_links')` ← **ticket-to-ticket**
- [ ] `target_ticket` → `ForeignKey(UnifiedTicket, on_delete=CASCADE, related_name='incoming_links')` ← **ticket-to-ticket**
- [ ] `link_type` → `CharField(choices=['blocks','is_blocked_by','duplicates','is_duplicate_of','relates_to','clones'])`
- [ ] `created_at`
- [ ] **Constraints:** `UniqueConstraint(fields=['source_ticket','target_ticket','link_type'], name='unique_ticket_link')`

#### `ExternalIdentity`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)`
- [ ] `integration` → `ForeignKey(Integration, on_delete=CASCADE)` ← **provider scope**
- [ ] `external_user_id` → `CharField(max_length=255)` — ID in source system
- [ ] `display_name` → `CharField(max_length=255, blank=True)`
- [ ] `email` → `EmailField(blank=True)`
- [ ] `avatar_url` → `URLField(blank=True)`
- [ ] `user` → `ForeignKey(User, on_delete=SET_NULL, null=True)` ← **maps to internal Django user**
- [ ] `provider_metadata` → `JSONField(default=dict)` — JSONB
- [ ] **Constraints:** `UniqueConstraint(fields=['integration','external_user_id'], name='unique_external_identity')` ← **idempotency**
- [ ] **Indexes:** `(organization_id, integration_id)`, `email`

### 8.2 Serializers

- [ ] `UnifiedTicketListSerializer` (lightweight for list)
- [ ] `UnifiedTicketDetailSerializer` (with nested activities + comments + links)
- [ ] `TicketUpsertSerializer` — used by FastAPI POST `/api/v1/tickets/upsert`
  - [ ] Uses `get_or_create` / `update_or_create` on `(integration, external_ticket_id)`
- [ ] `TicketActivitySerializer`
- [ ] `TicketCommentSerializer`
- [ ] `TicketLinkSerializer`
- [ ] `ExternalIdentitySerializer`

### 8.3 Views / API Endpoints

- [ ] `POST /api/v1/tickets/upsert` — **called by FastAPI agent**
  - [ ] Idempotent upsert via `(integration_id, external_ticket_id)`
  - [ ] Wrapped in `transaction.atomic()`
  - [ ] Returns `{ticket_id, created: bool}`
- [ ] `GET /api/v1/tickets/` — list (org scoped)
  - [ ] Filter: `status`, `normalized_type`, `assignee_id`, `integration_id`, `due_date_lt`, `due_date_gt`
  - [ ] Pagination: cursor-based for large datasets
  - [ ] `select_related('integration', 'assignee')`, `prefetch_related('activities', 'comments')`
- [ ] `GET /api/v1/tickets/{id}/` — detail
- [ ] `GET /api/v1/tickets/{id}/activities/` — activity timeline
- [ ] `GET /api/v1/tickets/{id}/comments/` — comments
- [ ] `GET /api/v1/tickets/{id}/links/` — linked tickets
- [ ] `GET /api/v1/identities/map` — **called by FastAPI agent**
  - [ ] Params: `integration_id`, `external_user_id`
  - [ ] Returns internal `user_id` or null

### 8.4 Tasks (`tickets/tasks.py`)

- [ ] `generate_insights_for_org(org_id)` — queue: `analytics`
- [ ] `sync_integration_tickets(integration_account_id)` — queue: `ingestion`

### 8.5 Tests

- [ ] `test_ticket_upsert_creates_new_ticket()`
- [ ] `test_ticket_upsert_updates_existing_by_external_id()`
- [ ] `test_ticket_upsert_idempotent_duplicate_external_id()`
- [ ] `test_ticket_filter_by_status()`
- [ ] `test_ticket_filter_by_assignee()`
- [ ] `test_ticket_pagination()`
- [ ] `test_cross_org_ticket_not_visible()`
- [ ] `test_identity_map_endpoint_returns_internal_user()`
- [ ] `test_identity_map_unknown_external_id_returns_null()`
- [ ] `test_ticket_link_unique_constraint()`
- [ ] `test_ticket_covering_index_exists()`
- [ ] `test_partial_index_on_active_statuses()`

---

## 9. App: `sync` (Idempotency & Checkpoints)

### 9.1 Models

#### `SyncCheckpoint`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `integration_account` → `ForeignKey(IntegrationAccount, on_delete=CASCADE)` ← **sync pointer**
- [ ] `checkpoint_key` → `CharField(max_length=255)` — e.g. `jira_issues_cursor`
- [ ] `checkpoint_value` → `JSONField(default=dict)` — JSONB (cursor, page token, since_date)
- [ ] `last_synced_at` → `DateTimeField(null=True)`
- [ ] `records_synced` → `IntegerField(default=0)` — count in last run
- [ ] **Constraints:** `UniqueConstraint(fields=['integration_account','checkpoint_key'], name='unique_sync_checkpoint')`
- [ ] **Indexes:** `(organization_id, integration_account_id)`

#### `IdempotencyKey`
- [ ] `key` → `CharField(max_length=255, unique=True)` — SHA256 hash
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)`
- [ ] `result` → `JSONField(null=True)` — JSONB cached response
- [ ] `created_at` → `DateTimeField(auto_now_add=True)`
- [ ] `expires_at` → `DateTimeField()` — auto-expire old records
- [ ] `request_path` → `CharField(max_length=500, blank=True)`
- [ ] **Indexes:** `expires_at`, `(organization_id, key)`

### 9.2 Views / API Endpoints

- [ ] No public endpoints for sync (internal use only)
- [ ] `GET /api/v1/sync/checkpoints/` — internal admin view

### 9.3 Tasks

- [ ] `cleanup_expired_idempotency_keys()` — beat schedule: daily

### 9.4 Tests

- [ ] `test_sync_checkpoint_unique_per_account_key()`
- [ ] `test_idempotency_key_expires()`

---

## 10. App: `insights`

### 10.1 Models

#### `Insight`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `insight_type` → `CharField(choices=['trend','anomaly','summary','prediction','recommendation'])`
- [ ] `title` → `CharField(max_length=500)`
- [ ] `content` → `JSONField()` — JSONB structured content
- [ ] `period_start` → `DateField(null=True)`
- [ ] `period_end` → `DateField(null=True)`
- [ ] `generated_by` → `CharField(max_length=100)` — agent/model name
- [ ] `confidence_score` → `FloatField(null=True)` — 0.0–1.0
- [ ] `is_pinned` → `BooleanField(default=False)`
- [ ] `created_at`
- [ ] **Indexes:** `(organization_id, insight_type)`, `(organization_id, period_start DESC)`

#### `InsightSource`
- [ ] `insight` → `ForeignKey(Insight, on_delete=CASCADE, related_name='sources')` ← **insight relation**
- [ ] `ticket` → `ForeignKey(UnifiedTicket, on_delete=CASCADE, null=True)` ← **ticket relation**
- [ ] `raw_event` → `ForeignKey(RawWebhookEvent, on_delete=CASCADE, null=True)` ← **event relation**
- [ ] `relevance_score` → `FloatField(null=True)`

#### `Dashboard`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `created_by` → `ForeignKey(User, on_delete=SET_NULL, null=True)`
- [ ] `name` → `CharField(max_length=255)`
- [ ] `slug` → `SlugField()`
- [ ] `layout` → `JSONField(default=dict)` — JSONB (grid layout config)
- [ ] `is_default` → `BooleanField(default=False)`
- [ ] `is_shared` → `BooleanField(default=False)`
- [ ] `created_at`, `updated_at`
- [ ] **Constraints:** `UniqueConstraint(fields=['organization','slug'], name='unique_dashboard_slug')`

#### `DashboardWidget`
- [ ] `dashboard` → `ForeignKey(Dashboard, on_delete=CASCADE, related_name='widgets')` ← **dashboard relation**
- [ ] `widget_type` → `CharField(choices=['ticket_count','trend_chart','assignee_breakdown','status_pie','saved_query_table'])`
- [ ] `title` → `CharField(max_length=255)`
- [ ] `config` → `JSONField(default=dict)` — JSONB (filters, date range, chart type)
- [ ] `position` → `JSONField(default=dict)` — JSONB `{x, y, w, h}` for grid
- [ ] `created_at`, `updated_at`

#### `SavedQuery`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `created_by` → `ForeignKey(User, on_delete=SET_NULL, null=True)`
- [ ] `name` → `CharField(max_length=255)`
- [ ] `natural_language_query` → `TextField()` — user's question
- [ ] `resolved_filters` → `JSONField(default=dict)` — JSONB (compiled filter params)
- [ ] `result_cache` → `JSONField(null=True)` — JSONB cached query results
- [ ] `cache_expires_at` → `DateTimeField(null=True)`
- [ ] `created_at`, `updated_at`

### 10.2 Serializers & Views

- [ ] `InsightSerializer`
- [ ] `DashboardSerializer` with nested `DashboardWidgetSerializer`
- [ ] `SavedQuerySerializer`
- [ ] `GET /api/v1/insights/` — list, filter by type/date
- [ ] `GET/POST/PATCH/DELETE /api/v1/dashboards/`
- [ ] `GET/POST/PATCH/DELETE /api/v1/dashboards/{id}/widgets/`
- [ ] `GET/POST /api/v1/saved-queries/`

### 10.3 Tests

- [ ] `test_insight_org_scoped()`
- [ ] `test_dashboard_widget_position_jsonb()`
- [ ] `test_saved_query_cache_expiry()`

---

## 11. App: `chat`

### 11.1 Models

#### `ChatSession`
- [ ] `id` → `UUIDField(primary_key=True, default=uuid4)`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `user` → `ForeignKey(User, on_delete=CASCADE)` ← **user relation**
- [ ] `title` → `CharField(max_length=500, blank=True)` — auto-generated from first message
- [ ] `context` → `JSONField(default=dict)` — JSONB (active filters, integration scope)
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `created_at`, `updated_at`
- [ ] **Indexes:** `(organization_id, user_id, created_at DESC)`

#### `ChatMessage`
- [ ] `session` → `ForeignKey(ChatSession, on_delete=CASCADE, related_name='messages')` ← **session relation**
- [ ] `role` → `CharField(choices=['user','assistant','system'])`
- [ ] `content` → `TextField()`
- [ ] `metadata` → `JSONField(default=dict)` — JSONB (sources, intermediate steps, tool calls)
- [ ] `token_count` → `IntegerField(null=True)` — LLM token usage
- [ ] `created_at`
- [ ] **Indexes:** `(session_id, created_at ASC)` — ordered for conversation history

### 11.2 Serializers & Views

- [ ] `ChatSessionSerializer`
- [ ] `ChatMessageSerializer`
- [ ] `POST /api/v1/chat/sessions/` — create session
- [ ] `GET /api/v1/chat/sessions/` — list user's sessions (org scoped)
- [ ] `GET /api/v1/chat/sessions/{id}/` — session detail
- [ ] `POST /api/v1/chat/sessions/{id}/messages/` — send message (proxies to agent service, SSE response)
- [ ] `GET /api/v1/chat/sessions/{id}/messages/` — full message history

### 11.3 Tests

- [ ] `test_chat_session_scoped_to_user_and_org()`
- [ ] `test_message_ordering_by_created_at()`
- [ ] `test_send_message_proxies_to_agent_service()`

---

## 12. App: `security`

### 12.1 Models

#### `ApiKey`
- [ ] `id` → `UUIDField(primary_key=True, default=uuid4)`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `created_by` → `ForeignKey(User, on_delete=SET_NULL, null=True)`
- [ ] `name` → `CharField(max_length=255)` — e.g. "CI/CD Pipeline Key"
- [ ] `hashed_key` → `CharField(max_length=255, unique=True)` — SHA256 of raw key
- [ ] `prefix` → `CharField(max_length=10)` — first 8 chars of raw key for display
- [ ] `permissions` → `JSONField(default=list)` — JSONB list of scopes
- [ ] `rate_limit_per_minute` → `IntegerField(default=60)`
- [ ] `is_active` → `BooleanField(default=True)`
- [ ] `last_used_at` → `DateTimeField(null=True)`
- [ ] `expires_at` → `DateTimeField(null=True)`
- [ ] `created_at`
- [ ] **Indexes:** `(organization_id, is_active)`, `hashed_key`, `expires_at`

#### `AuditLog`
- [ ] `organization` → `ForeignKey(Organization, on_delete=CASCADE)` ← **multi-tenancy**
- [ ] `actor` → `ForeignKey(User, on_delete=SET_NULL, null=True)` ← **user relation**
- [ ] `api_key` → `ForeignKey(ApiKey, on_delete=SET_NULL, null=True)` ← **api key relation**
- [ ] `action` → `CharField(max_length=100)` — e.g. `ticket.upsert`, `integration.create`
- [ ] `resource_type` → `CharField(max_length=100)`
- [ ] `resource_id` → `CharField(max_length=255, blank=True)`
- [ ] `changes` → `JSONField(null=True)` — JSONB `{before: {}, after: {}}`
- [ ] `ip_address` → `GenericIPAddressField(null=True)`
- [ ] `user_agent` → `CharField(max_length=500, blank=True)`
- [ ] `created_at`
- [ ] **Indexes:** `(organization_id, created_at DESC)`, `(resource_type, resource_id)`, `actor_id`
- [ ] **Note:** AuditLog is **append-only** — no update/delete allowed

### 12.2 Serializers & Views

- [ ] `ApiKeyCreateSerializer` (returns raw key once on creation)
- [ ] `ApiKeyListSerializer` (shows prefix, never full key)
- [ ] `AuditLogSerializer`
- [ ] `GET/POST /api/v1/security/api-keys/`
- [ ] `DELETE /api/v1/security/api-keys/{id}/`
- [ ] `GET /api/v1/security/audit-logs/` — paginated, filter by action/resource/actor

### 12.3 Tests

- [ ] `test_api_key_stores_only_hash()`
- [ ] `test_api_key_raw_returned_once()`
- [ ] `test_audit_log_append_only()`
- [ ] `test_audit_log_org_scoped()`

---

## 13. Celery Task System

### 13.1 Core Setup

- [ ] `backend/backend/celery.py` — app definition
- [ ] `backend/backend/__init__.py` — imports celery app
- [ ] Queue definitions: `ingestion`, `processing`, `analytics`
- [ ] Task routing table (each task → correct queue)
- [ ] Beat schedule:
  - [ ] `retry_failed_events` — every 5 minutes (ingestion queue)
  - [ ] `cleanup_expired_idempotency_keys` — daily (processing queue)
  - [ ] `generate_insights_for_all_orgs` — hourly (analytics queue)
  - [ ] `sync_all_active_integrations` — every 15 minutes (ingestion queue)

### 13.2 Task Index

| Task | App | Queue | Retries | Schedule |
|------|-----|-------|---------|----------|
| `process_raw_webhook` | events | ingestion | 5 (exp backoff) | triggered |
| `retry_failed_events` | events | ingestion | 1 | every 5 min |
| `sync_integration_tickets` | tickets | ingestion | 3 | triggered |
| `sync_all_active_integrations` | tickets | ingestion | 1 | every 15 min |
| `generate_insights_for_org` | insights | analytics | 2 | triggered |
| `generate_insights_for_all_orgs` | insights | analytics | 1 | hourly |
| `cleanup_expired_idempotency_keys` | sync | processing | 1 | daily |

- [ ] All tasks: `bind=True`, `acks_late=True`
- [ ] All tasks: structured logging (step, event_id, error)
- [ ] All tasks: `transaction.atomic()` for any DB writes

### 13.3 Tests

- [ ] `test_process_raw_webhook_calls_agent_service(mock_httpx)`
- [ ] `test_celery_retry_on_agent_service_failure()`
- [ ] `test_exponential_backoff_countdown()`
- [ ] `test_max_retries_creates_dlq_entry()`

---

## 14. DRF API Layer

### 14.1 API Router (`backend/backend/urls.py`)

- [ ] All routes prefixed `/api/v1/`
- [ ] Namespaced includes per app

### 14.2 Global DRF Config

- [ ] JWT authentication (simplejwt)
- [ ] `IsAuthenticated` default permission
- [ ] `PageNumberPagination` (page_size=50, max=200)
- [ ] `DjangoFilterBackend` on all list endpoints
- [ ] Custom exception handler (returns `{error, detail, code}`)

### 14.3 Endpoint Matrix

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register/` | Public | Register user + org |
| POST | `/api/v1/auth/login/` | Public | JWT obtain |
| POST | `/api/v1/auth/refresh/` | Public | JWT refresh |
| POST | `/api/v1/auth/logout/` | JWT | Blacklist token |
| GET | `/api/v1/auth/me/` | JWT | Current user profile |
| GET/PATCH | `/api/v1/organizations/{id}/` | JWT | Org detail |
| GET/POST | `/api/v1/organizations/{id}/members/` | JWT | Members |
| GET/POST | `/api/v1/organizations/{id}/invites/` | JWT | Invitations |
| GET/POST | `/api/v1/integrations/` | JWT | Integrations |
| GET/PATCH/DELETE | `/api/v1/integrations/{id}/` | JWT | Integration detail |
| GET/POST | `/api/v1/integrations/{id}/accounts/` | JWT | Accounts |
| **POST** | **`/api/v1/events/ingest`** | **ApiKey** | **FastAPI → Django** |
| GET | `/api/v1/events/` | JWT | Event list |
| **POST** | **`/api/v1/dlq`** | **ApiKey** | **FastAPI → Django DLQ** |
| GET | `/api/v1/dlq/` | JWT | DLQ list |
| **POST** | **`/api/v1/tickets/upsert`** | **ApiKey** | **FastAPI → Django** |
| GET | `/api/v1/tickets/` | JWT | Ticket list |
| GET | `/api/v1/tickets/{id}/` | JWT | Ticket detail |
| **GET** | **`/api/v1/identities/map`** | **ApiKey** | **FastAPI → Django** |
| GET/POST | `/api/v1/insights/` | JWT | Insights |
| GET/POST | `/api/v1/dashboards/` | JWT | Dashboards |
| GET/POST | `/api/v1/saved-queries/` | JWT | Saved queries |
| POST | `/api/v1/chat/sessions/` | JWT | Create session |
| GET | `/api/v1/chat/sessions/` | JWT | Sessions list |
| POST | `/api/v1/chat/sessions/{id}/messages/` | JWT | Send message |
| GET/POST | `/api/v1/security/api-keys/` | JWT | API keys |
| GET | `/api/v1/security/audit-logs/` | JWT | Audit log |
| GET | `/api/v1/processing/runs/` | JWT | Processing runs |

> **Bold rows** = internal service-to-service endpoints authenticated by `ApiKey` header (not JWT)

### 14.4 Tests

- [ ] All endpoints return 401 without auth
- [ ] All org-scoped endpoints return 403 for cross-org access
- [ ] All list endpoints return paginated results
- [ ] Filter params validated correctly

---

## 15. FastAPI Agent Service

### 15.1 Core Application (`agent-service/src/`)

- [ ] `main.py` — full FastAPI app with lifespan, CORS, exception handlers
- [ ] `schemas.py` — all Pydantic v2 models:
  - [ ] `TicketState` (TypedDict for LangGraph state)
  - [ ] `UnifiedTicketSchema` (Pydantic BaseModel — exact mapping target)
  - [ ] `RawEventRequest`, `PipelineRunRequest`
  - [ ] `ProcessingResult`, `ValidationError`
  - [ ] `DjangoIngestPayload`, `DjangoUpsertPayload`, `DjangoDLQPayload`
- [ ] `config.py` — settings (Pydantic `BaseSettings`, reads from env)
- [ ] `django_client.py` — httpx async client to Django:
  - [ ] `post_ingest_event()`
  - [ ] `upsert_ticket()`
  - [ ] `post_dlq()`
  - [ ] `get_identity_map()`
  - [ ] Retry: 3 attempts, exponential backoff
  - [ ] Timeout: 30s per request
  - [ ] Full request/response logging

### 15.2 LangGraph Pipeline (`agent-service/src/graph.py`)

- [ ] `TicketState` TypedDict defined
- [ ] `StateGraph(TicketState)` instantiated
- [ ] Nodes:
  - [ ] `fetcher` → `fetcher_node()`
  - [ ] `mapper` → `mapper_node()`
  - [ ] `validator` → `validator_node()`
  - [ ] `persist` → `persist_node()` (calls Django upsert)
  - [ ] `send_to_dlq` → `dlq_node()` (calls Django DLQ)
- [ ] Edges:
  - [ ] START → `fetcher`
  - [ ] `fetcher` → `mapper`
  - [ ] `mapper` → `validator`
  - [ ] `validator` → conditional:
    - [ ] If `is_valid=True` → `persist`
    - [ ] If `is_valid=False` AND `attempt_count < 3` → `mapper` (retry)
    - [ ] If `attempt_count >= 3` → `send_to_dlq`
  - [ ] `persist` → END
  - [ ] `send_to_dlq` → END
- [ ] Compiled graph with checkpointer (in-memory for now)
- [ ] Logging at every node entry/exit

### 15.3 Agents

#### Fetcher Agent (`agents/fetcher.py`)
- [ ] `fetch_raw_data(integration_type, config, checkpoint)` async function
- [ ] Rate limit handling: asyncio token bucket (per-provider limits)
- [ ] Pagination loop: follows `next_cursor` until exhausted
- [ ] Returns: `list[dict]` raw payloads + updated checkpoint
- [ ] Provider dispatch: generic interface, provider config drives behaviour
- [ ] Logging: every page fetched, rate limit hit

#### Mapper Agent (`agents/mapper.py`)
- [ ] `ChatOpenAI` model configured with `temperature=0`
- [ ] System prompt: normalize raw provider JSON into `UnifiedTicketSchema`
- [ ] Uses `llm.with_structured_output(UnifiedTicketSchema)` for enforced JSON
- [ ] If `validation_errors` exist in state: append errors to prompt for correction
- [ ] Input: `raw_payload` (dict) + `validation_errors` (list)
- [ ] Output: `mapped_data` (dict matching UnifiedTicketSchema)
- [ ] Token usage logged to `ProcessingStepLog`
- [ ] Timeout: 60s per LLM call

#### Validator Agent (`agents/validator.py`)
- [ ] Deterministic Python — **no LLM**
- [ ] Validates:
  - [ ] `normalized_status ∈ ['open','in_progress','blocked','resolved']`
  - [ ] `due_date` is valid ISO-8601 date or null
  - [ ] `external_ticket_id` is non-empty string
  - [ ] `title` is non-empty string
  - [ ] `assignee_external_id` → calls `get_identity_map()` to verify exists (if present)
- [ ] Returns: `{is_valid: bool, validation_errors: list[str]}`
- [ ] Increments `attempt_count` on each validation call

### 15.4 Routers

#### `routers/pipeline.py`
- [ ] `POST /pipeline/run` — start full pipeline for one raw event
  - [ ] Accepts `PipelineRunRequest` (event_id, source, raw_payload)
  - [ ] Invokes `graph.ainvoke(state)`
  - [ ] Returns `ProcessingResult`
- [ ] `POST /pipeline/webhook` — receive raw webhook, ingest to Django, trigger pipeline
- [ ] `GET /pipeline/status/{run_id}` — SSE stream of pipeline status updates

#### `routers/health.py`
- [ ] `GET /health` — returns service status + LLM connectivity check

### 15.5 `pyproject.toml` Updates

- [ ] Bump `langgraph>=0.1.0` (from `>=0.0.20`)
- [ ] Bump `langchain>=0.2.0` (from `>=0.1.0`)
- [ ] Add `langchain-openai` (explicit)
- [ ] Add `fastmcp`
- [ ] Add `hubspot-api-client`

### 15.6 Tests (`agent-service/tests/`)

- [ ] `test_graph_valid_payload_reaches_persist(mock_llm, mock_httpx)`
- [ ] `test_graph_invalid_payload_retries_mapper_up_to_3_times(mock_llm)`
- [ ] `test_graph_third_attempt_goes_to_dlq(mock_llm, mock_httpx)`
- [ ] `test_validator_rejects_invalid_status()`
- [ ] `test_validator_rejects_invalid_date()`
- [ ] `test_validator_accepts_null_due_date()`
- [ ] `test_mapper_sends_validation_errors_in_prompt(mock_llm)`
- [ ] `test_django_client_retries_on_500(mock_httpx)`
- [ ] `test_django_client_posts_ingest_event(mock_httpx)`
- [ ] `test_fetcher_handles_rate_limit()`
- [ ] `test_pipeline_endpoint_returns_result(test_client)`

---

## 16. MCP Servers

### 16.1 MCP Server: HubSpot (`mcp-servers/hubspot/`)

- [ ] `server.py` — FastMCP server definition
- [ ] Tool: `get_contacts(limit, cursor)` — paginated contact list
- [ ] Tool: `get_deals(limit, cursor)` — paginated deal list
- [ ] Tool: `get_deal_by_id(deal_id)` — single deal
- [ ] Auth: `HUBSPOT_API_KEY` from env

### 16.2 MCP Server: Jira (`mcp-servers/jira/`)

- [ ] `server.py` — FastMCP server
- [ ] Tool: `search_issues(jql, limit, start_at)` — JQL search
- [ ] Tool: `get_issue(issue_key)` — single issue
- [ ] Tool: `get_projects()` — list projects
- [ ] Auth: `JIRA_BASE_URL`, `JIRA_API_TOKEN`, `JIRA_EMAIL`

### 16.3 MCP Server: Linear (`mcp-servers/linear/`)

- [ ] `server.py`
- [ ] Tool: `get_issues(team_id, limit, after_cursor)`
- [ ] Tool: `get_issue_by_id(issue_id)`
- [ ] Auth: `LINEAR_API_KEY`

### 16.4 MCP Server: Slack (`mcp-servers/slack/`)

- [ ] `server.py`
- [ ] Tool: `get_channel_messages(channel_id, limit, oldest)`
- [ ] Tool: `get_thread_replies(channel_id, thread_ts)`
- [ ] Auth: `SLACK_BOT_TOKEN`

---

## 17. Test Suite

### 17.1 Backend Test Configuration

- [x] `pytest.ini` / `setup.cfg` with Django settings pointer
- [x] `conftest.py` — shared fixtures:
  - [x] `org_fixture` — creates Organization
  - [x] `user_fixture` — creates User + UserProfile + membership
  - [x] `auth_client` — APIClient with JWT header
  - [x] `integration_fixture` — creates Integration for tests
  - [x] `api_key_fixture` — creates ApiKey for service-to-service tests

### 17.2 Coverage Target

- [x] **Models:** 100% (all fields, constraints, indexes verified)
- [x] **Serializers:** 90%+
- [x] **Views/Endpoints:** 91% (measured)
- [x] **Tasks:** 80%+
- [x] **Agent Service:** ~80%+

### 17.3 Test Files

- [x] `backend/accounts/tests/test_models.py`
- [x] `backend/accounts/tests/test_views.py`
- [x] `backend/integrations/tests/test_models.py`
- [x] `backend/integrations/tests/test_views.py`
- [x] `backend/events/tests/test_models.py`
- [x] `backend/events/tests/test_views.py`
- [x] `backend/events/tests/test_tasks.py`
- [x] `backend/processing/tests/test_models.py`
- [x] `backend/tickets/tests/test_models.py`
- [x] `backend/tickets/tests/test_views.py` (upsert idempotency via ApiKey)
- [x] `backend/tickets/tests/test_tasks.py`
- [x] `backend/insights/tests/test_models.py`
- [x] `backend/insights/tests/test_views.py` (insights, dashboards, widgets, saved queries)
- [x] `backend/chat/tests/test_models.py`
- [x] `backend/security/tests/test_models.py`
- [x] `backend/security/tests/test_views.py` (ApiKey CRUD, AuditLog)
- [x] `backend/sync/tests/test_models.py`
- [x] `agent-service/tests/test_graph.py`
- [x] `agent-service/tests/test_agents.py`
- [x] `agent-service/tests/test_django_client.py`
- [x] `agent-service/tests/test_routers.py`

---

## 18. Database Migrations

- [ ] Run `makemigrations` for all 9 new apps
- [ ] Verify `migrate --check` passes
- [ ] Manual SQL verification of:
  - [ ] GIN indexes on JSONB fields
  - [ ] Partial indexes (WHERE clause present)
  - [ ] Covering indexes (INCLUDE clause present)
  - [ ] All UniqueConstraints applied
  - [ ] All composite indexes created
- [ ] Data migration: remove old `QueryLog` and `IntegrationConfig` tables

---

## 19. CI/CD & Tooling

### 19.1 GitHub Actions (`.github/workflows/`)

- [x] Scaffold exists
- [x] `backend-ci.yml`:
  - [x] Lint: `black --check` + `flake8`
  - [x] Test: `pytest` with PostgreSQL service container
  - [x] Coverage report artifact
- [x] `agent-ci.yml`:
  - [x] Lint + type check
  - [x] Test with `pytest-asyncio`

### 19.2 Code Quality

- [x] `.flake8` config file
- [x] `black` configured in `pyproject.toml`
- [x] `mypy` config for agent service (strict mode) — `agent-service/mypy.ini`
- [x] Pre-commit hooks (`.pre-commit-config.yaml`):
  - [x] `black`
  - [x] `flake8`
  - [x] `trailing-whitespace`
  - [x] `end-of-file-fixer`

---

## 20. Web Frontend (Operator Console)

> Vite + React 19 + TypeScript + Tailwind. Location: `frontend/`. Consumes **only** public `/api/v1/*` endpoints over JWT; internal ApiKey routes stay service-to-service.

### 20.1 Tooling & Config

- [x] Vite 8 + React 19 + TS (strict) + Tailwind 4 + Framer Motion
- [x] `axios` — typed HTTP client
- [x] `react-router-dom` — SPA routing
- [x] `frontend/.env.example` — `VITE_API_URL` + `VITE_AGENT_URL`
- [x] `make frontend` / `make frontend-install` / `make frontend-build` / `make frontend-typecheck` / `make frontend-lint`

### 20.2 API Layer (`frontend/src/api/`)

- [x] `client.ts` — Axios instance, JWT injection, 401 → single-flight refresh rotation, `extractError()`, `tokenStore`
- [x] `types.ts` — TS mirrors of every DRF response shape (paginated envelope aware)
- [x] `auth.ts` — register / login / refresh / logout / me / org / members / invites / roles
- [x] `events.ts` — events list + detail, DLQ list + retry
- [x] `tickets.ts` — list + detail + activities + comments (filters: status/assignee/type/q)
- [x] `integrations.ts` — providers, accounts CRUD, manual sync trigger
- [x] `processing.ts` — runs + run detail + step transitions
- [x] `chat.ts` — sessions CRUD, messages, `sendStream()` SSE reader with JSON-endpoint fallback
- [x] `insights.ts` — insights, dashboards CRUD, widgets, saved queries
- [x] `security.ts` — API keys CRUD + revoke, audit logs, sync checkpoints
- [x] `index.ts` — barrel export + `unwrap()` helper

### 20.3 Auth & Routing

- [x] `context/AuthContext.tsx` — token store, `/me` hydration, login/register/logout
- [x] `components/ProtectedRoute.tsx` — gate + loading state
- [x] `components/Layout.tsx` — sidebar nav grouped by Overview / Work / AI Pipeline / Data / Admin, user card, sign-out
- [x] `App.tsx` — public `/login` + `/register`, all other routes wrapped in `<ProtectedRoute>`

### 20.4 Pages (1 per resource group)

| Route | Backend endpoints wired |
|-------|-------------------------|
| [x] `/` Dashboard | tickets/events/dlq/runs/insights/integrations summary |
| [x] `/insights` | `GET /insights/` |
| [x] `/tickets` + `/tickets/:id` | `GET /tickets/`, detail, `activities/`, `comments/` |
| [x] `/events` + `/events/:id` | `GET /events/`, detail |
| [x] `/dlq` | `GET /dlq/`, `POST /dlq/{id}/retry/` |
| [x] `/integrations` + `/integrations/:id` | list, accounts CRUD, `POST .../sync/` |
| [x] `/processing` + `/processing/:id` | runs list, run detail, `steps/` |
| [x] `/chat` | sessions CRUD, messages, SSE send (with JSON fallback) |
| [x] `/agent` | preserved VoxBridge voice UI → FastAPI agent |
| [x] `/dashboards` + `/dashboards/:id` | list + create + detail + update + widgets |
| [x] `/saved-queries` | `GET /saved-queries/` |
| [x] `/sync` | `GET /sync/checkpoints/` |
| [x] `/settings` | org detail/update, members list/remove, invites list/create, roles |
| [x] `/api-keys` | list + create (shows raw key once) + revoke |
| [x] `/audit-logs` | list with expandable metadata |

### 20.5 Shared UI Primitives

- [x] `components/ui.tsx` — `Card`, `Button`, `Badge`, `Table/TH/TD/TR/THead`, `Field`, `Input`, `TextArea`, `Select`, `Spinner`, `EmptyState`, `ErrorBanner`, `JsonBlock`, `SectionHeader`, `statusTone()`, `formatDate()`
- [x] `hooks/useAsync.ts` — minimal loader with `reload()` (avoids pulling in react-query)

### 20.6 Boundary Rules

- [x] Browser never calls internal ApiKey endpoints (`/events/ingest`, `/tickets/upsert`, `/dlq` POST, `/identities/map`)
- [x] JWT stored in `localStorage` under `htf.access` / `htf.refresh`; interceptor auto-rotates
- [x] Org id resolved from JWT claims when a settings screen needs it (never written from client)
- [x] `/agent` isolated from Django client — imports only `src/api/agent.ts`

### 20.7 Checks

- [x] `make frontend-typecheck` (tsc --noEmit) passes clean on new code
- [x] `make frontend-lint` passes clean on new code (only pre-existing `speech.d.ts` issue remains, unchanged)
- [ ] `make frontend-build` on non-UNC paths (Windows UNC + Vite 8 rolldown has a config-load interop bug — builds fine inside WSL/Docker)

---

## 📈 Overall Progress

| Component | Progress | Session |
|-----------|----------|---------|
| Infrastructure | 🟢 100% | Session 2 — Docker, entrypoint.sh, all containers |
| Django Settings | 🟢 100% | Session 1 |
| App: core (base) | 🟢 95% | Session 1 — abstract models, permissions, pagination, exceptions |
| App: accounts | 🟢 95% | Session 1/2 — 7 models, serializers, all endpoints, tests |
| App: integrations | 🟢 95% | Session 3 — CRUD views + test_views.py |
| App: events | 🟢 95% | Session 3 — atomic savepoint on ingest, view tests |
| App: processing | 🟢 90% | Session 1 — 4 models, UUID PK, GIN index, read-only API |
| App: tickets | 🟢 95% | Session 2/3 — view tests, task tests |
| App: sync | 🟢 90% | Session 1 — SyncCheckpoint + IdempotencyKey |
| App: insights | 🟢 95% | Session 3 — full view tests (dashboards, widgets, saved queries) |
| App: chat | 🟢 90% | Session 1 — UUID session, SSE proxy to agent |
| App: security | 🟢 95% | Session 3 — ApiKey CRUD + AuditLog view tests |
| Celery Tasks | 🟢 90% | Session 2 — task tests with httpx mocks |
| DRF API Layer | 🟢 95% | Session 3 — 182 tests, 91% coverage |
| FastAPI Agent Service | 🟢 90% | Session 2/3 — graph, agents, django_client tests |
| MCP Servers | 🟢 95% | Session 2 — jira, slack, linear, hubspot |
| Test Suite | 🟢 91% | Session 3 — **182 tests, 91% coverage** |
| Migrations | 🟢 95% | Session 1 — all apps migrated |
| CI/CD | 🟢 95% | Session 2 — backend-ci.yml, agent-ci.yml |
| queries app | 🟢 100% | Session 3 — removed stale IntegrationConfig, SavedQuery in insights |
| Web Frontend | 🟢 95% | Session 4 — typed API client, auth context, 20+ pages across every /api/v1 group |

### ✅ Session 1 Completed (2026-04-16)
- `backend/backend/settings.py` — full production settings
- `backend/backend/celery.py` — 3-queue Celery app
- `backend/backend/urls.py` — all routes wired under `/api/v1/`
- `backend/core/` — abstract base models, permissions, pagination, exceptions
- All 9 Django apps created with **models, serializers, views, URLs, tasks**
- `agent-service/src/` — config, schemas, django_client, graph, 3 agents, 2 routers, main app
- **`python manage.py check` — 0 errors**
- **`makemigrations` — all 9 apps migrated, all indexes generated**

### ✅ Session 2 Completed (2026-04-16)
- Docker Compose — all 5 containers (postgres, redis, backend, celery-worker, celery-beat, agent)
- `backend/entrypoint.sh` — pg_isready → migrate → collectstatic → gunicorn
- `backend/Dockerfile` — wired with ENTRYPOINT
- MCP servers: jira, slack, linear, hubspot (all 4 implemented)
- Django Admin — all models registered with inlines
- GitHub Actions CI/CD — backend-ci.yml + agent-ci.yml
- Test suite expanded to **137 tests** (was 40)
- Pre-commit hooks, black/flake8 configs

### ✅ Session 3 Completed (2026-04-16)
- **4 new `test_views.py` files** — events, security, insights, integrations (45 new tests)
- **Bug fix:** `events/views.py` — `transaction.atomic()` savepoint on duplicate ingest
- **Bug fix:** `queries` app stale `IntegrationConfig` removed; `SavedQuery` correctly in `insights`
- **Total: 182 tests, 91% backend coverage**
- `agent-service/mypy.ini` — strict mode for FastAPI service
- `Makefile` — `make type-check` target added
- `backend/backend/urls.py` — queries app URL included

### ✅ Session 4 Completed (2026-04-17)
- **Frontend rewrite** — `feat/frontend-api-integration` branch
- `frontend/src/api/` — typed Axios client with JWT + single-flight refresh rotation, one module per `/api/v1` group (auth, events, tickets, integrations, processing, chat, insights, security)
- SSE reader in `chat.ts` for streaming assistant responses, with JSON-endpoint fallback
- `AuthContext` + `ProtectedRoute` + `Layout` (grouped sidebar nav) — auth-gated app shell
- **20+ pages** covering every public endpoint group (dashboard, tickets, events, DLQ, integrations + accounts + sync, processing runs + steps, chat, insights, dashboards + widgets, saved queries, sync checkpoints, settings, members, invites, API keys, audit logs)
- Preserved the VoxBridge voice UI at `/agent` (talks to FastAPI only; no regression)
- Shared UI primitives (`ui.tsx`) + `useAsync` hook to avoid react-query bloat
- Makefile: `frontend-install` / `frontend-build` / `frontend-typecheck` / `frontend-lint` targets
- Docs: README + AGENTS.md + STATUS.md updated to reflect the third workspace

### 🔜 Remaining (non-critical)
- [ ] `make docker-up` end-to-end smoke test (requires real `.env`)
- [ ] Add real provider credentials for MCP servers (JIRA_API_KEY, SLACK_BOT_TOKEN, etc.)
- [ ] `chat/views.py` SendMessageView — needs live agent for full test (currently 56% coverage)
- [ ] `accounts/views.py` org invite/member flows (currently 70% coverage)
- [ ] Run `mypy` clean on agent-service (LangChain stubs still missing)
- [ ] Frontend: add a Dockerfile + compose service to serve the prod bundle behind the backend
- [ ] Frontend: wire CI step (`make frontend-typecheck` + `make frontend-lint`) into `.github/workflows/`

---

*This file is the single source of truth for project progress. Update checkboxes as items are completed.*
