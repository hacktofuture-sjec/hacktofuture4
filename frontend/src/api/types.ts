/**
 * Shared TypeScript types mirroring the Django DRF backend response shapes.
 * Kept intentionally permissive (optional fields, index signatures on JSONB
 * payloads) because several models expose free-form `settings`, `preferences`,
 * `payload`, `metadata`, etc.
 */

// ── Pagination ─────────────────────────────────────────────────────────────

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Auth / Identity ────────────────────────────────────────────────────────

export interface AuthTokens {
  access: string;
  refresh: string;
  user_id?: string;
  email?: string;
}

export interface UserProfile {
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  avatar_url?: string | null;
  timezone?: string;
  preferences?: Record<string, unknown>;
  is_onboarded?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier?: string;
  settings?: Record<string, unknown>;
  is_active?: boolean;
  member_count?: number;
  created_at?: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role_name: string;
  is_active: boolean;
  joined_at: string;
}

export interface OrganizationInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | string;
  expires_at: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
}

// ── Events / DLQ ───────────────────────────────────────────────────────────

export interface RawEvent {
  id: string;
  integration_id?: string;
  source?: string;
  external_id?: string;
  payload: Record<string, unknown>;
  status?: 'pending' | 'processed' | 'failed' | string;
  received_at?: string;
  processed_at?: string | null;
  attempts?: number;
}

export interface DLQItem {
  id: string;
  event_id?: string;
  reason?: string;
  validation_errors?: string[];
  payload?: Record<string, unknown>;
  created_at?: string;
  last_attempt_at?: string;
  attempts?: number;
}

// ── Tickets ────────────────────────────────────────────────────────────────

export interface ExternalIdentityRef {
  id?: string;
  display_name?: string;
  email?: string;
}

export interface UnifiedTicket {
  id: string;
  /** DRF: `external_ticket_id` (e.g. PROJ-123). */
  external_ticket_id?: string;
  /** Legacy/alternate name used in some UIs — prefer `external_ticket_id`. */
  external_id?: string;
  provider?: string;
  title: string;
  description?: string;
  normalized_status: 'open' | 'in_progress' | 'blocked' | 'resolved' | string;
  normalized_type?: string;
  priority?: string;
  assignee_id?: string | null;
  /** Present on list responses (`assignee_name`). */
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee?: ExternalIdentityRef | null;
  reporter?: ExternalIdentityRef | null;
  reporter_email?: string | null;
  due_date?: string | null;
  provider_metadata?: Record<string, unknown>;
  integration?: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface TicketActivity {
  id: string;
  ticket_id?: string;
  /** DRF: `activity_type` + `changes` (JSON). */
  activity_type?: string;
  actor_name?: string;
  changes?: Record<string, { from?: unknown; to?: unknown }>;
  occurred_at?: string;
  /** Legacy shape — not returned by current serializers. */
  actor?: string;
  action?: string;
  from_value?: string | null;
  to_value?: string | null;
  created_at?: string;
  payload?: Record<string, unknown>;
}

export interface TicketComment {
  id: string;
  ticket_id?: string;
  author_name?: string;
  author_email?: string;
  body: string;
  created_at?: string;
  external_id?: string;
  provider?: string;
}

// ── Integrations ───────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities?: string[];
  is_active?: boolean;
  icon_url?: string;
}

export interface IntegrationAccount {
  id: string;
  integration_id: string;
  organization_id: string;
  display_name?: string;
  status?: 'connected' | 'disconnected' | 'error' | string;
  last_synced_at?: string | null;
  config?: Record<string, unknown>;
  created_at?: string;
}

// ── Processing / Observability ─────────────────────────────────────────────

export interface ProcessingRun {
  id: string;
  /** FK to RawWebhookEvent — DRF exposes `raw_event_id`. */
  raw_event_id?: string | number;
  /** Legacy client field name — prefer `raw_event_id`. */
  event_id?: string | number;
  status:
    | 'started'
    | 'mapping'
    | 'validating'
    | 'completed'
    | 'failed'
    | 'running'
    | 'succeeded'
    | 'retry'
    | string;
  attempt_count?: number;
  llm_model?: string;
  source?: string;
  started_at?: string;
  /** DRF field name (replaces older UI name `finished_at`). */
  completed_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  step_logs?: ProcessingStep[];
  validation_result?: { is_valid?: boolean; validation_errors?: string[]; validated_at?: string };
}

export interface ProcessingStep {
  id: string;
  /** DRF: `step_name` (fetcher, mapper, …). */
  step_name?: string;
  node?: string;
  sequence?: number;
  status: string;
  input_data?: Record<string, unknown> | null;
  output_data?: Record<string, unknown> | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error_message?: string;
  error?: string | null;
  logged_at?: string;
  created_at?: string;
  duration_ms?: number | null;
}

// ── Chat ───────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | string;
  content: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  tool_calls?: Record<string, unknown>[];
}

// ── Insights / Dashboards ──────────────────────────────────────────────────

export interface Insight {
  id: string;
  insight_type?: string;
  title: string;
  /** Django JSONField — structured content; use `formatInsightText()` for display. */
  content?: unknown;
  /** Not sent by API — only if you map client-side. */
  body?: string;
  period_start?: string;
  period_end?: string;
  generated_by?: string;
  confidence_score?: number | null;
  is_pinned?: boolean;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  title: string;
  widget_type: string;
  config?: Record<string, unknown>;
  created_at?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: Record<string, unknown>;
  created_at?: string;
}

// ── Security / Infra ───────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  prefix?: string;
  key?: string;
  created_at?: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  scopes?: string[];
}

export interface AuditLog {
  id: string;
  actor?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export interface SyncCheckpoint {
  id: string;
  integration_account_id?: string;
  resource: string;
  last_synced_time: string;
  cursor?: string;
  updated_at?: string;
}
