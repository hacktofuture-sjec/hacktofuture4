export type MonitorService = {
  service: string;
  reachable: boolean;
  health: 'healthy' | 'degraded' | 'critical' | 'down' | string;
  mode: string;
};

export type MLInsight = {
  anomaly?: boolean;
  anomalyDetected?: boolean;
  anomaly_detected?: boolean;
  suspectedService?: string | null;
  service?: string | null;
  confidenceScore?: number;
  confidence_score?: number;
  confidence?: number;
  severity?: string;
  reason?: string;
  reasoning?: string;
  explanation?: string;
  predictedClass?: string;
  predicted_class?: string;
  scores?: Array<{
    service?: string;
    anomaly?: boolean;
    score?: number;
  }>;
  // Extended ML fields
  predictedIncidentType?: string;
  anomalyScore?: number;
  anomaly_score?: number;
  confidenceLevel?: string;
  recommendedAction?: string;
  recommended_action?: string;
  isSafeToExecute?: boolean;
  executionMode?: string;
  execution_mode?: string;
  contributingSignals?: string[];
  contributingFactors?: string[];
  classProbs?: Record<string, number>;
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
    anomalyDetected?: boolean;
    anomaly_detected?: boolean;
    service?: string | null;
    confidence?: number;
    confidence_score?: number;
    reason?: string;
    explanation?: string;
    predictedClass?: string;
    predicted_class?: string;
    severity?: string;
    executionMode?: string;
    execution_mode?: string;
    recommendedAction?: string;
    recommended_action?: string;
    anomalyScore?: number;
    anomaly_score?: number;
    isSafeToExecute?: boolean;
  } | null;
  mlInsight?: MLInsight | null;
};

export type ResolvedMlData = {
  available: boolean;
  anomaly: boolean | null;
  service: string | null;
  confidence: number | null;
  confidenceLabel: 'High Confidence' | 'Medium Confidence' | 'Low Confidence' | 'Unknown Confidence';
  reason: string | null;
  explanation: string | null;
  severity: string | null;
  executionMode: string | null;
  // Extended fields
  predictedSystemState?: string | null;
  predictedIncidentType?: string | null;
  anomalyScore?: number | null;
  confidenceLevel?: string | null;
  recommendedAction?: string | null;
  isSafeToExecute?: boolean | null;
  contributingSignals?: string[] | null;
  contributingFactors?: string[] | null;
  classProbs?: Record<string, number> | null;
};

const pickString = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const pickBoolean = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
};

const pickNumber = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

const normalizeConfidence = (value: number | null) => {
  if (value === null) return null;
  if (value > 1 && value <= 100) return value / 100;
  if (value >= 0 && value <= 1) return value;
  return null;
};

const deriveConfidenceLabel = (value: number | null): ResolvedMlData['confidenceLabel'] => {
  if (value === null) return 'Unknown Confidence';
  const percent = value * 100;
  if (percent >= 80) return 'High Confidence';
  if (percent >= 50) return 'Medium Confidence';
  return 'Low Confidence';
};

const normalizeExecutionMode = (value: string | null, isSafeToExecute: boolean | null) => {
  if (value) return value;
  if (isSafeToExecute === true) return 'safe';
  if (isSafeToExecute === false) return 'manual';
  return null;
};

export function resolveMlData(data: AgentAnalyzeResponse | null | undefined): ResolvedMlData {
  const ml = data?.ml || null;
  const insight = data?.mlInsight || null;

  const anomaly = pickBoolean(
    ml?.anomaly,
    ml?.anomalyDetected,
    ml?.anomaly_detected,
    insight?.anomaly,
    insight?.anomalyDetected,
    insight?.anomaly_detected,
  );

  const service =
    pickString(ml?.service, insight?.suspectedService)
    || null;

  const confidenceRaw = pickNumber(
    ml?.confidence,
    ml?.confidence_score,
    insight?.confidence,
    insight?.confidenceScore,
    insight?.confidence_score,
  );

  const confidence = normalizeConfidence(confidenceRaw);

  const reason =
    pickString(ml?.reason, ml?.explanation, insight?.reason, insight?.reasoning, insight?.explanation)
    || null;

  const explanation =
    pickString(ml?.explanation, insight?.explanation, insight?.reasoning, insight?.reason)
    || reason;

  const severity = pickString(ml?.severity, insight?.severity);

  // Extended ML fields
  const predictedSystemState = pickString(ml?.predictedClass, ml?.predicted_class, insight?.predictedClass, insight?.predicted_class);
  const predictedIncidentType = pickString(insight?.predictedIncidentType, predictedSystemState) || null;
  const anomalyScore = pickNumber(ml?.anomalyScore, ml?.anomaly_score, insight?.anomalyScore, insight?.anomaly_score);
  const confidenceLevel = pickString(insight?.confidenceLevel) || deriveConfidenceLabel(confidence).split(' ')[0]?.toLowerCase() || null;
  const recommendedAction = pickString(ml?.recommendedAction, ml?.recommended_action, insight?.recommendedAction, insight?.recommended_action) || null;
  const isSafeToExecute = pickBoolean(ml?.isSafeToExecute, insight?.isSafeToExecute) ?? null;
  const executionMode = normalizeExecutionMode(pickString(ml?.executionMode, ml?.execution_mode, insight?.executionMode, insight?.execution_mode), isSafeToExecute);
  const contributingSignals = Array.isArray(insight?.contributingSignals) ? insight.contributingSignals : null;
  const contributingFactors = Array.isArray(insight?.contributingFactors) ? insight.contributingFactors : null;
  const classProbs = typeof insight?.classProbs === 'object' && insight?.classProbs ? insight.classProbs : null;

  return {
    available: Boolean(ml || insight),
    anomaly,
    service,
    confidence,
    confidenceLabel: deriveConfidenceLabel(confidence),
    reason,
    explanation,
    severity,
    executionMode,
    predictedSystemState,
    predictedIncidentType,
    anomalyScore,
    confidenceLevel,
    recommendedAction,
    isSafeToExecute,
    contributingSignals,
    contributingFactors,
    classProbs,
  };
}

const normalizeBaseUrl = (value?: string) => (value || '').replace(/\/+$/, '');

const getAgentBaseUrl = () => {
  const apiUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  if (apiUrl) return apiUrl;

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
