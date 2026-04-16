/**
 * Security & infrastructure — API keys, audit logs, sync checkpoints.
 */
import { apiDelete, apiGet, apiPost } from './client';
import type { ApiKey, AuditLog, Paginated, SyncCheckpoint } from './types';

export const securityApi = {
  listApiKeys: () =>
    apiGet<Paginated<ApiKey> | ApiKey[]>('/security/api-keys/'),

  createApiKey: (body: { name: string; scopes?: string[] }) =>
    apiPost<ApiKey>('/security/api-keys/', body),

  revokeApiKey: (id: string) =>
    apiDelete<{ detail?: string }>(`/security/api-keys/${id}/`),

  auditLogs: (params?: Record<string, string | number | undefined>) =>
    apiGet<Paginated<AuditLog> | AuditLog[]>('/security/audit-logs/', {
      params,
    }),

  syncCheckpoints: (params?: Record<string, string | number | undefined>) =>
    apiGet<Paginated<SyncCheckpoint> | SyncCheckpoint[]>(
      '/sync/checkpoints/',
      { params }
    ),
};
