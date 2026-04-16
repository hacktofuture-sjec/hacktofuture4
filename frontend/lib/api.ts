import {
  DiagnosisPayload,
  ExecutorResult,
  IncidentDetail,
  IncidentListItem,
  PlannerOutput,
  TimelineEvent,
  VerificationOutput,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const method = options?.method?.toUpperCase() ?? "GET";
  const hasBody = options?.body !== undefined && options?.body !== null;

  if (hasBody && method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  healthz: () => apiFetch<{ status: string; version: string }>("/healthz"),

  listIncidents: (params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status !== undefined) searchParams.set("status", params.status);
    if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    return apiFetch<IncidentListItem[]>(`/incidents${query ? `?${query}` : ""}`).then(
      (rows) => {
        const normalized = rows.map((row) => ({
          ...row,
          updated_at: (row as any).updated_at ?? (row as any).created_at,
          monitor_confidence: Number((row as any).monitor_confidence ?? 0),
          severity: ((row as any).severity ?? "medium") as IncidentListItem["severity"],
        }));
        return { total: normalized.length, incidents: normalized };
      }
    );
  },

  getIncident: (id: string) =>
    apiFetch<any>(`/incidents/${id}`).then((incident) => {
      const normalized: IncidentDetail = {
        ...incident,
        namespace: incident.namespace ?? incident.scope?.namespace ?? "default",
        pod: incident.pod ?? incident.snapshot?.pod ?? "unknown",
        monitor_confidence: Number(incident.monitor_confidence ?? incident.snapshot?.monitor_confidence ?? 0),
        severity: incident.severity ?? "medium",
        updated_at: incident.updated_at ?? incident.created_at,
        plan: incident.plan ?? incident.plan_json ?? null,
        token_summary: incident.token_summary ?? null,
        resolved_at: incident.resolved_at ?? null,
      };
      return normalized;
    }),

  getTimeline: (id: string) =>
    apiFetch<{ incident_id: string; events: TimelineEvent[] }>(`/incidents/${id}/timeline`),

  injectFault: (scenario_id: string) =>
    apiFetch<{ incident_id: string; status: string }>("/inject-fault", {
      method: "POST",
      body: JSON.stringify({ scenario_id }),
    }),

  listScenarios: () =>
    apiFetch<{ scenario_id: string; name: string; failure_class: string }[]>("/scenarios"),

  diagnose: (id: string) => apiFetch<DiagnosisPayload>(`/incidents/${id}/diagnose`, { method: "POST" }),

  plan: (id: string) => apiFetch<PlannerOutput>(`/incidents/${id}/plan`, { method: "POST" }),

  approve: (id: string, action_index: number, approved: boolean, note?: string) =>
    apiFetch<{ status: string; message: string }>(`/incidents/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ action_index, approved, operator_note: note ?? "" }),
    }),

  execute: (id: string) =>
    apiFetch<ExecutorResult>(`/incidents/${id}/execute`, { method: "POST" }),

  verify: (id: string) =>
    apiFetch<VerificationOutput>(`/incidents/${id}/verify`, { method: "POST" }),

  getCostReport: (id?: string) =>
    apiFetch<any>(`/cost-report${id ? `?incident_id=${id}` : ""}`).then((report) => ({
      incident_id: id,
      total_input_tokens: Number(report.total_input_tokens ?? report.actual_tokens ?? 0),
      total_output_tokens: Number(report.total_output_tokens ?? 0),
      total_ai_calls: Number(report.total_ai_calls ?? report.calls ?? 0),
      total_actual_cost_usd: Number(report.total_actual_cost_usd ?? report.total_estimated_cost_usd ?? 0),
    })),
};
