/**
 * events.urls — raw JSONB event sourcing + DLQ.
 * Ingestion/upsert/dlq-post are internal ApiKey endpoints, but we still expose
 * read + manual-retry routes to the frontend.
 */
import { apiGet, apiPost } from './client';
import type { DLQItem, Paginated, RawEvent } from './types';

export const eventsApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiGet<Paginated<RawEvent> | RawEvent[]>('/events/', { params }),

  get: (id: string) => apiGet<RawEvent>(`/events/${id}/`),

  listDLQ: (params?: Record<string, string | number | undefined>) =>
    apiGet<Paginated<DLQItem> | DLQItem[]>('/dlq/', { params }),

  retryDLQ: (id: string) => apiPost<{ detail: string }>(`/dlq/${id}/retry/`),
};
