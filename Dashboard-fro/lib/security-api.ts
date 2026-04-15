export type SecurityStatus = {
  overall: 'secure' | 'suspicious' | 'threat_detected' | string;
  threatLevel: 'low' | 'medium' | 'high' | string;
  activeAlerts: number;
  blockedSources: Array<{
    sourceIp: string;
    reason?: string;
    blockedAt?: string;
    expiresAt?: string;
  }>;
  suspiciousSources: Array<{
    sourceIp: string;
    reason?: string;
    timestamp?: string;
  }>;
};

export type SecurityAlert = {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  service: string;
  sourceIp: string;
  message: string;
  timestamp: string;
};

export type SecurityTelemetry = {
  status: SecurityStatus | null;
  alerts: SecurityAlert[];
};

const normalizeBaseUrl = (value?: string) => (value || '').replace(/\/+$/, '');

const getSecurityBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_SECURITY_BASE_URL);
  if (envBase) return envBase;
  return 'http://127.0.0.1:3005';
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Security request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchSecurityStatus(): Promise<SecurityStatus> {
  const baseUrl = getSecurityBaseUrl();
  return fetchJson<SecurityStatus>(`${baseUrl}/security/status`);
}

export async function fetchSecurityAlerts(limit = 12): Promise<SecurityAlert[]> {
  const baseUrl = getSecurityBaseUrl();
  const payload = await fetchJson<{ alerts?: SecurityAlert[] }>(`${baseUrl}/security/alerts?limit=${limit}`);
  return payload.alerts || [];
}

export async function fetchSecurityTelemetry(limit = 12): Promise<SecurityTelemetry> {
  const [status, alerts] = await Promise.all([
    fetchSecurityStatus(),
    fetchSecurityAlerts(limit),
  ]);

  return { status, alerts };
}
