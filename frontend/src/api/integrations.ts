/**
 * integrations.urls — providers, accounts (OAuth/API key config), sync triggers.
 */
import { apiGet, apiPost } from './client';
import type { Integration, IntegrationAccount, Paginated } from './types';

export const integrationsApi = {
  list: () =>
    apiGet<Paginated<Integration> | Integration[]>('/integrations/'),

  get: (id: string) => apiGet<Integration>(`/integrations/${id}/`),

  listAccounts: (integrationId: string) =>
    apiGet<Paginated<IntegrationAccount> | IntegrationAccount[]>(
      `/integrations/${integrationId}/accounts/`
    ),

  createAccount: (
    integrationId: string,
    body: Partial<IntegrationAccount> & { config?: Record<string, unknown> }
  ) =>
    apiPost<IntegrationAccount>(
      `/integrations/${integrationId}/accounts/`,
      body
    ),

  triggerSync: (integrationId: string, accountId: string) =>
    apiPost<{ detail: string; task_id?: string }>(
      `/integrations/${integrationId}/accounts/${accountId}/sync/`
    ),
};
