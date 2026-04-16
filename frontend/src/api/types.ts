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

export interface UnifiedTicket {
  id: string;
  external_id?: string;
  provider?: string;
  title: string;
  description?: string;
  normalized_status: 'open' | 'in_progress' | 'blocked' | 'resolved' | string;
  normalized_type?: string;
  priority?: string;
  assignee_id?: string | null;
  assignee_email?: string | null;
  reporter_email?: string | null;
  due_date?: string | null;
  provider_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  actor?: string;
  action?: string;
  from_value?: string | null;
  to_value?: string | null;
  created_at?: string;
  payload?: Record<string, unknown>;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
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
  event_id?: string;
  status: 'running' | 'succeeded' | 'failed' | 'retry' | string;
  attempt_count?: number;
  source?: string;
  started_at?: string;
  finished_at?: string | null;
  error?: string | null;
}

export interface ProcessingStep {
  id: string;
  run_id: string;
  node: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
  created_at?: string;
  duration_ms?: number;
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
  title: string;
  body?: string;
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
