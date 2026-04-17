/**
 * Map Django/DRF response shapes to strings the UI can render.
 * Keeps display logic out of pages when API uses JSON fields or different names.
 */

import type { Insight, TicketActivity } from '../api/types';

/** Insights use `content` (JSON); older UI assumed `body` (string). */
export function formatInsightText(insight: Pick<Insight, 'content' | 'body'>): string {
  if (insight.body != null && String(insight.body).trim() !== '') {
    return String(insight.body);
  }
  const c = insight.content;
  if (c == null) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'object') {
    const o = c as Record<string, unknown>;
    if (typeof o.summary === 'string') return o.summary;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.message === 'string') return o.message;
    return JSON.stringify(c, null, 2);
  }
  return String(c);
}

/** Ticket activities use `activity_type` + `changes`, not action/from/to. */
export function formatActivityDescription(a: TicketActivity): string {
  const label = (a.activity_type || 'activity').replace(/_/g, ' ');
  const changes = a.changes;
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
    return label;
  }
  const parts = Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>).map(
    ([field, pair]) =>
      `${field}: ${JSON.stringify(pair?.from)} → ${JSON.stringify(pair?.to)}`
  );
  return `${label} — ${parts.join('; ')}`;
}
