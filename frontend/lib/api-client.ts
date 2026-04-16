// API client — thin wrapper over fetch

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  // Incidents
  listIncidents: (limit = 50) =>
    get<{ incidents: unknown[] }>(`/incidents?limit=${limit}`),
  getIncident: (id: string) =>
    get<Record<string, unknown>>(`/incidents/${id}`),

  // Approvals
  approveIncident: (id: string, reviewed_by = "human", notes?: string) =>
    post(`/incidents/${id}/approve`, { reviewed_by, notes }),
  rejectIncident: (id: string, reviewed_by = "human", notes?: string) =>
    post(`/incidents/${id}/reject`, { reviewed_by, notes }),

  // Simulate
  simulate: (scenario: string) =>
    post<{ incident_id: string }>("/webhook/simulate", { scenario }),

  // Vault
  listVault: (source?: string) =>
    get<{ entries: unknown[] }>(`/vault${source ? `?source=${source}` : ""}`),
  vaultStats: () => get<Record<string, unknown>>("/vault/stats"),

  // Metrics
  summary: () => get<Record<string, unknown>>("/metrics/summary"),
  rlEpisodes: () => get<{ episodes: unknown[] }>("/metrics/rl"),

  // SSE stream URL (not a fetch — used directly in hooks)
  streamUrl: (incidentId: string) => `${BASE}/stream/${incidentId}`,
};
