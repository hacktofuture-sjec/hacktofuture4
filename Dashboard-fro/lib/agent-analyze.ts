export type MonitorService = {
  service: string;
  reachable: boolean;
  health: 'healthy' | 'degraded' | 'critical' | 'down' | string;
  mode: string;
};

export type AgentAnalyzeResponse = {
  success: boolean;
  monitoring?: {
    overall?: 'healthy' | 'degraded' | 'critical' | string;
    timestamp?: string;
    services?: MonitorService[];
  };
  kubernetesSignals?: {
    available?: boolean;
    namespace?: string;
    podName?: string | null;
    restartCount?: number;
    deploymentReplicas?: number;
    deploymentAvailableReplicas?: number;
    resourceOverload?: boolean;
    persistentFailure?: boolean;
    restartAgeMs?: number;
    reason?: string;
    logsExcerpt?: string;
    detectedKeywords?: string[];
  };
  rca?: {
    rootCause?: string | null;
    reason?: string;
    severity?: string;
    rootCauseType?: string;
    evidence?: Record<string, unknown>;
    analyzedAt?: string;
  };
  decision?: {
    actionNeeded?: boolean;
    action?: string;
    target?: string | null;
    explanation?: string;
  };
  ml?: {
    anomaly?: boolean;
    service?: string | null;
    confidence?: number;
    reason?: string;
  } | null;
  mlInsight?: {
    anomaly?: boolean;
    suspectedService?: string | null;
    confidenceScore?: number;
    confidence?: number;
    severity?: string;
    reason?: string;
    reasoning?: string;
    scores?: Array<{
      service?: string;
      anomaly?: boolean;
      score?: number;
    }>;
  } | null;
};

export type ResolvedMlData = {
  available: boolean;
  anomaly: boolean | null;
  service: string | null;
  confidence: number | null;
  reason: string | null;
};

export function resolveMlData(data: AgentAnalyzeResponse | null | undefined): ResolvedMlData {
  const ml = data?.ml || null;
  const insight = data?.mlInsight || null;

  const anomalyFromInsight = typeof insight?.anomaly === 'boolean' ? insight.anomaly : null;
  const anomaly = typeof ml?.anomaly === 'boolean' ? ml.anomaly : anomalyFromInsight;

  const service =
    (typeof ml?.service === 'string' && ml.service.trim())
    || (typeof insight?.suspectedService === 'string' && insight.suspectedService.trim())
    || null;

  const confidenceRaw =
    typeof ml?.confidence === 'number'
      ? ml.confidence
      : typeof insight?.confidence === 'number'
        ? insight.confidence
        : typeof insight?.confidenceScore === 'number'
          ? insight.confidenceScore
          : null;

  const confidence = typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : null;

  const reason =
    (typeof ml?.reason === 'string' && ml.reason.trim())
    || (typeof insight?.reason === 'string' && insight.reason.trim())
    || (typeof insight?.reasoning === 'string' && insight.reasoning.trim())
    || null;

  return {
    available: Boolean(ml || insight),
    anomaly,
    service,
    confidence,
    reason,
  };
}

const normalizeBaseUrl = (value?: string) => (value || '').replace(/\/+$/, '');

const getAgentBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_AGENT_BASE_URL);
  if (envBase) return envBase;

  const legacyEnvBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_AGENT_URL);
  if (legacyEnvBase) return legacyEnvBase;

  return 'http://127.0.0.1:4000';
};

export async function fetchAgentAnalyze(): Promise<AgentAnalyzeResponse> {
  const baseUrl = getAgentBaseUrl();
  const response = await fetch(`${baseUrl}/agent/analyze`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Analyze request failed with status ${response.status}`);
  }

  const data = (await response.json()) as AgentAnalyzeResponse;
  return data;
}
