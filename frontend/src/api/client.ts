/**
 * Central Axios client for the Django backend (`/api/v1/*`).
 *
 * Responsibilities:
 *   - Inject JWT access token on every request
 *   - Transparently refresh expired access tokens using the refresh token
 *   - Centralize base URL + error shape
 *
 * The FastAPI agent service has its own client (see `./agent.ts`) — do NOT
 * mix the two. Agent endpoints use `/pipeline/action` etc., the Django backend
 * uses `/api/v1/*` with JWT.
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ACCESS_KEY = 'htf.access';
const REFRESH_KEY = 'htf.refresh';

// ── Token helpers ──────────────────────────────────────────────────────────

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Axios instance ─────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor → attach Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh queue (prevents 10 concurrent refreshes on 401) ────────────────

let isRefreshing = false;
let pending: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  pending.forEach((cb) => cb(token));
  pending = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
    const access = res.data?.access as string | undefined;
    if (access) {
      tokenStore.set(access, refresh);
      return access;
    }
  } catch {
    // fall through
  }
  return null;
}

// Response interceptor → 401 → refresh and retry once
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retried = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pending.push((token) => {
            if (!token) return reject(error);
            if (original.headers) {
              original.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      flushQueue(newToken);

      if (newToken) {
        if (original.headers) {
          original.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(original);
      }

      tokenStore.clear();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Typed helpers ──────────────────────────────────────────────────────────

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

export async function apiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await api.post<T>(url, body, config);
  return data;
}

export async function apiPut<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await api.put<T>(url, body, config);
  return data;
}

export async function apiPatch<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await api.patch<T>(url, body, config);
  return data;
}

export async function apiDelete<T = void>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await api.delete<T>(url, config);
  return data;
}

/** Normalise a single DRF / serializer error item to a string. */
function normalizeErrorItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'string' in item) {
    return String((item as { string: string }).string);
  }
  return String(item);
}

/**
 * Parse Django REST Framework validation errors `{ field: string[] | ErrorDetail[] }`.
 * Returns `null` if the body is not a field-error map (e.g. only `{ detail: "..." }`).
 */
export function parseDrfFieldErrors(err: unknown): Record<string, string[]> | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 400) return null;
  const raw = err.response?.data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key === 'detail') continue;
    if (Array.isArray(val)) {
      const msgs = val.map(normalizeErrorItem).filter(Boolean);
      if (msgs.length) out[key] = msgs;
    } else if (typeof val === 'string' && val) {
      out[key] = [val];
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Thrown from auth flows when the API fails; may include DRF `fieldErrors` for HTTP 400. */
export class ApiRequestError extends Error {
  readonly fieldErrors: Record<string, string[]> | null;

  constructor(message: string, fieldErrors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.fieldErrors = fieldErrors;
  }
}

// Human-readable API error message extractor for toasts/UI.
export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { detail?: string; error?: string; [k: string]: unknown }
      | undefined;
    if (typeof data === 'string') return data;
    if (data?.detail !== undefined && data?.detail !== null) {
      const d = data.detail;
      if (typeof d === 'string') return d;
      if (Array.isArray(d)) {
        const parts = d.map(normalizeErrorItem).filter(Boolean);
        if (parts.length) return parts.join(' · ');
      }
    }
    if (data?.error) return String(data.error);
    if (data && typeof data === 'object') {
      // DRF validation: include every field and every message (not just the first).
      const lines: string[] = [];
      for (const [field, msgs] of Object.entries(data)) {
        if (field === 'detail' && typeof msgs === 'string') {
          lines.push(msgs);
          continue;
        }
        if (Array.isArray(msgs)) {
          const parts = msgs.map(normalizeErrorItem).filter(Boolean);
          if (parts.length) {
            const label = field === 'non_field_errors' ? 'Error' : field.replace(/_/g, ' ');
            lines.push(`${label}: ${parts.join(' · ')}`);
          }
        } else if (typeof msgs === 'string' && msgs) {
          lines.push(`${field.replace(/_/g, ' ')}: ${msgs}`);
        }
      }
      if (lines.length) return lines.join('\n');
    }
    return err.message || 'Request failed';
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
