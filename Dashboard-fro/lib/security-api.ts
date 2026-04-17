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

const getSecurityBaseUrl = (): string => {
  // Try environment variable first
  const envBase = process.env.NEXT_PUBLIC_SECURITY_BASE_URL;
  if (envBase && envBase.trim()) {
    const normalized = normalizeBaseUrl(envBase);
    console.debug(`[Security API] Using NEXT_PUBLIC_SECURITY_BASE_URL: ${normalized}`);
    return normalized;
  }
  
  // Fallback for local development
  const fallback = 'http://localhost:3005';
  console.debug(`[Security API] NEXT_PUBLIC_SECURITY_BASE_URL not set, using fallback: ${fallback}`);
  return fallback;
};

async function fetchJson<T>(url: string): Promise<T> {
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    console.debug(`[Security API] Fetching: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Security request failed with status ${response.status}: ${text.slice(0, 100)}`);
    }

    const data = await response.json() as T;
    console.debug(`[Security API] Success:`, data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      console.error(`[Security API] Fetch error:`, error.message);
      if (error.name === 'AbortError') {
        throw new Error('Security request timeout (8s)');
      }
      throw error;
    }
    throw new Error('Unknown error fetching security data');
  }
}

export async function fetchSecurityStatus(): Promise<SecurityStatus> {
  const baseUrl = getSecurityBaseUrl();
  const url = `${baseUrl}/security/status`;
  
  try {
    return await fetchJson<SecurityStatus>(url);
  } catch (error) {
    console.error('[Security API] fetchSecurityStatus failed:', error);
    throw error;
  }
}

export async function fetchSecurityAlerts(limit = 20): Promise<SecurityAlert[]> {
  const baseUrl = getSecurityBaseUrl();
  const url = `${baseUrl}/security/alerts?limit=${limit}`;
  
  try {
    const payload = await fetchJson<{ alerts?: SecurityAlert[] }>(url);
    return payload.alerts || [];
  } catch (error) {
    console.error('[Security API] fetchSecurityAlerts failed:', error);
    throw error;
  }
}

export async function fetchSecurityTelemetry(
  limit = 20
): Promise<SecurityTelemetry> {
  try {
    const [status, alerts] = await Promise.all([
      fetchSecurityStatus(),
      fetchSecurityAlerts(limit),
    ]);

    return { status, alerts };
  } catch (error) {
    console.error('[Security API] fetchSecurityTelemetry failed:', error);
    throw error;
  }
}
