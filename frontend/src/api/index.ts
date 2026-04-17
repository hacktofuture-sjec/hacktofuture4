/**
 * Barrel export for the backend API layer. Keeps call sites tidy:
 *   import { ticketsApi, eventsApi } from '@/api';
 */
export { api, apiGet, apiPost, apiPut, apiPatch, apiDelete, extractError, tokenStore, API_BASE } from './client';
export { authApi } from './auth';
export { eventsApi } from './events';
export { ticketsApi } from './tickets';
export { integrationsApi } from './integrations';
export { processingApi } from './processing';
export { chatApi } from './chat';
export { insightsApi } from './insights';
export { securityApi } from './security';
export * from './types';

/** Unwraps a DRF list response (either a paginated envelope or a raw array). */
export function unwrap<T>(resp: T[] | { results: T[] } | undefined | null): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray((resp as { results?: T[] }).results)) {
    return (resp as { results: T[] }).results;
  }
  return [];
}
