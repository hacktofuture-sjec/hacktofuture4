'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchAgentAnalyze, type AgentAnalyzeResponse } from '@/lib/agent-analyze';
import { resolveMlData } from '@/lib/agent-analyze';
import { AlertTriangle, TrendingDown, Zap } from 'lucide-react'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'

type AnomalySeverity = 'critical' | 'warning' | 'info';

type UiAnomaly = {
  id: string;
  serviceId: string;
  serviceName: string;
  severity: AnomalySeverity;
  metric: string;
  title: string;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  confidence: number;
  timestamp: string;
  explanation: string;
  rootCause?: string | null;
  decisionExplanation?: string;
};

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

const severityFromRca = (severity?: string): AnomalySeverity => {
  const normalized = normalize(severity);
  if (normalized === 'high') return 'critical';
  if (normalized === 'medium') return 'warning';
  return 'info';
};

const confidenceFromSeverity = (severity: AnomalySeverity) => {
  if (severity === 'critical') return 90;
  if (severity === 'warning') return 70;
  return 50;
};

const resolveDescription = (data: AgentAnalyzeResponse, fallback: string) => {
  return data.rca?.reason || data.kubernetesSignals?.reason || fallback;
};

function buildAnomalies(data: AgentAnalyzeResponse): UiAnomaly[] {
  const monitorServices = data.monitoring?.services ?? [];
  const restartCount = data.kubernetesSignals?.restartCount ?? 0;
  const resourceOverload = Boolean(data.kubernetesSignals?.resourceOverload);
  const rootCause = normalize(data.rca?.rootCause);
  const actionNeeded = Boolean(data.decision?.actionNeeded);
  const ml = resolveMlData(data);
  const timestamp = data.monitoring?.timestamp || data.rca?.analyzedAt || new Date().toISOString();

  const results: UiAnomaly[] = [];
  const seen = new Set<string>();

  const pushAnomaly = (partial: Omit<UiAnomaly, 'id' | 'confidence' | 'timestamp'> & { timestamp?: string }) => {
    const key = `${partial.serviceId}|${partial.title}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      ...partial,
      id: `anomaly-${seen.size}`,
      confidence: confidenceFromSeverity(partial.severity),
      timestamp: partial.timestamp || timestamp,
    });
  };

  if (resourceOverload) {
    pushAnomaly({
      serviceId: 'messaging-service',
      serviceName: 'messaging-service',
      severity: 'critical',
      metric: 'resource_overload',
      title: 'Traffic Overload Detected',
      currentValue: 100,
      baselineValue: 60,
      deviation: 66.7,
      explanation: resolveDescription(data, 'Resource overload detected in messaging-service.'),
      rootCause: data.rca?.rootCause,
      decisionExplanation: data.decision?.explanation,
    });
  }

  if (restartCount >= 1) {
    const restartSeverity: AnomalySeverity = restartCount >= 2 ? 'critical' : 'warning';
    const restartService = rootCause || normalize(data.decision?.target) || normalize(monitorServices[0]?.service) || 'messaging-service';
    pushAnomaly({
      serviceId: restartService,
      serviceName: restartService,
      severity: restartSeverity,
      metric: 'restart_count',
      title: 'Service Restart Loop',
      currentValue: restartCount,
      baselineValue: 0,
      deviation: restartCount * 100,
      explanation: resolveDescription(data, `Service restarted ${restartCount} time(s).`),
      rootCause: data.rca?.rootCause,
      decisionExplanation: data.decision?.explanation,
    });
  }

  monitorServices.forEach((service) => {
    const serviceId = normalize(service.service);
    const health = normalize(service.health);
    const mode = normalize(service.mode);
    const unhealthy = health !== 'healthy' || mode !== 'normal';
    if (!unhealthy) return;

    const isCritical = health === 'critical' || health === 'down' || health === 'error' || health === 'crash';
    const severity: AnomalySeverity = isCritical ? 'critical' : 'warning';
    const title = mode === 'latency' ? 'Latency Spike Detected' : mode === 'error' ? 'Error Pattern Detected' : 'Service Deviation Detected';

    pushAnomaly({
      serviceId,
      serviceName: service.service,
      severity,
      metric: `${mode || 'health'}_anomaly`,
      title,
      currentValue: severity === 'critical' ? 90 : 70,
      baselineValue: 50,
      deviation: severity === 'critical' ? 80 : 40,
      explanation: resolveDescription(data, `${service.service} reported ${service.health}/${service.mode}.`),
      rootCause: data.rca?.rootCause,
      decisionExplanation: data.decision?.explanation,
    });
  });

  if (rootCause) {
    pushAnomaly({
      serviceId: rootCause,
      serviceName: rootCause,
      severity: severityFromRca(data.rca?.severity),
      metric: 'rca_root_cause',
      title: 'Root Cause Identified',
      currentValue: 100,
      baselineValue: 0,
      deviation: 100,
      explanation: resolveDescription(data, `Root cause linked to ${rootCause}.`),
      rootCause: data.rca?.rootCause,
      decisionExplanation: data.decision?.explanation,
    });
  }

  if (actionNeeded) {
    const target = normalize(data.decision?.target) || rootCause || normalize(monitorServices[0]?.service) || 'messaging-service';
    pushAnomaly({
      serviceId: target,
      serviceName: target,
      severity: 'warning',
      metric: 'action_needed',
      title: 'AI Action Recommended',
      currentValue: 1,
      baselineValue: 0,
      deviation: 100,
      explanation: resolveDescription(data, data.decision?.explanation || 'AI remediation action recommended.'),
      rootCause: data.rca?.rootCause,
      decisionExplanation: data.decision?.explanation,
    });
  }

  if (ml.available) {
    const mlService = normalize(ml.service) || rootCause || normalize(monitorServices[0]?.service) || 'ml-signal';
    const mlConfidence = typeof ml.confidence === 'number' ? Math.max(0, Math.min(1, ml.confidence)) : null;
    const mlSeverity: AnomalySeverity = ml.anomaly ? 'critical' : 'info';

    pushAnomaly({
      serviceId: mlService,
      serviceName: ml.service || mlService,
      severity: mlSeverity,
      metric: 'ml_anomaly',
      title: ml.anomaly ? 'ML Model Detected Anomaly' : 'ML Model Normal Signal',
      currentValue: mlConfidence !== null ? Math.round(mlConfidence * 100) : ml.anomaly ? 90 : 30,
      baselineValue: 50,
      deviation: mlConfidence !== null ? Math.round(Math.abs(mlConfidence - 0.5) * 200) : ml.anomaly ? 80 : 40,
      explanation: ml.reason || (ml.anomaly ? 'ML model detected anomalous behavior.' : 'ML model reports normal operating behavior.'),
      rootCause: data.rca?.rootCause || ml.service || null,
      decisionExplanation: data.decision?.explanation,
    });
  }

  return results;
}

export default function AnomaliesPage() {
  const [analyze, setAnalyze] = useState<AgentAnalyzeResponse | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const next = await fetchAgentAnalyze();
        if (!isMounted) return;
        setAnalyze(next);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const anomalies = useMemo(() => buildAnomalies(analyze ?? { success: false }), [analyze]);
  const mlResolved = useMemo(() => resolveMlData(analyze ?? { success: false }), [analyze]);

  useEffect(() => {
    if (anomalies.length === 0) {
      setSelectedAnomalyId(null);
      return;
    }

    if (!selectedAnomalyId || !anomalies.some((anomaly) => anomaly.id === selectedAnomalyId)) {
      setSelectedAnomalyId(anomalies[0].id);
    }
  }, [anomalies, selectedAnomalyId]);

  const selectedAnomaly = anomalies.find((anomaly) => anomaly.id === selectedAnomalyId) ?? null;
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  const warningAnomalies = anomalies.filter((a) => a.severity === 'warning');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Anomaly Detection</h1>
          <p className="text-gray-600 dark:text-white/60">Early warning system catching deviations before downtime occurs</p>
        </div>

        {/* Severity Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InternalGlassPanel className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-300/30 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-300/20 blur-[20px] to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Total Anomalies</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{anomalies.length}</p>
              </div>
              <Zap className="h-12 w-12 text-primary/30" />
            </div>
          </InternalGlassPanel>
          <InternalGlassPanel className="overflow-hidden border-destructive/20">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-red-400/30 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-red-400/20 blur-[20px] to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-destructive">Critical</p>
                <p className="text-3xl font-bold text-destructive">{criticalAnomalies.length}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-destructive/30" />
            </div>
          </InternalGlassPanel>
          <InternalGlassPanel className="overflow-hidden border-yellow-500/20">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-300/30 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-yellow-300/20 blur-[20px] to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-yellow-500">Warnings</p>
                <p className="text-3xl font-bold text-yellow-500">{warningAnomalies.length}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-yellow-500/30" />
            </div>
          </InternalGlassPanel>
          <InternalGlassPanel className={`overflow-hidden ${mlResolved.anomaly ? 'border-destructive/20' : 'border-emerald-500/20'}`}>
            <div className={`absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent ${mlResolved.anomaly ? 'via-red-400/30' : 'via-emerald-400/30'} to-transparent`} />
            <div className={`absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent ${mlResolved.anomaly ? 'via-red-400/20' : 'via-emerald-400/20'} blur-[20px] to-transparent`} />
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-gray-600 dark:text-white/60">ML Signal</p>
                <p className={`text-2xl font-bold ${mlResolved.anomaly ? 'text-destructive' : 'text-emerald-500'}`}>
                  {mlResolved.available ? (mlResolved.anomaly ? 'Anomaly' : 'Normal') : 'N/A'}
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                  {typeof mlResolved.confidence === 'number' ? `${(mlResolved.confidence * 100).toFixed(1)}% confidence` : 'No confidence data'}
                </p>
              </div>
              <TrendingDown className={`h-12 w-12 ${mlResolved.anomaly ? 'text-destructive/30' : 'text-emerald-500/30'}`} />
            </div>
          </InternalGlassPanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Engine Feed */}
          <InternalGlassPanel className="lg:col-span-1 bg-blue-50 dark:bg-[#0B1220]/70 border-blue-200 dark:border-white/10">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">AI Engine Feed</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {anomalies.map((anomaly) => (
                <button
                  key={anomaly.id}
                  onClick={() => setSelectedAnomalyId(anomaly.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedAnomaly?.id === anomaly.id
                      ? 'border-primary/40 bg-primary/20 text-gray-900 dark:text-white'
                      : 'border-white/10 bg-[#0B1220]/40 text-gray-700 dark:text-white/80 hover:border-blue-500/20 hover:bg-blue-500/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        anomaly.severity === 'critical' ? 'bg-destructive' : 'bg-yellow-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{anomaly.serviceName}</p>
                      <p className="truncate text-xs text-gray-600 dark:text-white/60">{anomaly.title}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-white/50">
                        {new Date(anomaly.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {anomalies.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-600 dark:text-white/60">{loading ? 'Analyzing signals...' : 'No anomalies detected'}</p>
              )}
            </div>
          </InternalGlassPanel>

          {/* Detailed Analysis */}
          <InternalGlassPanel className="lg:col-span-2 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
            {selectedAnomaly ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedAnomaly.serviceName}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedAnomaly.severity === 'critical'
                          ? 'bg-destructive/20 text-destructive'
                          : selectedAnomaly.severity === 'warning'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {selectedAnomaly.severity.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{selectedAnomaly.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-white/60">{selectedAnomaly.explanation}</p>
                </div>

                {/* Metrics Breakdown */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">AI Insight Panel</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Root Cause</span>
                        <span className="text-sm text-gray-600 dark:text-white/60">{selectedAnomaly.rootCause || 'Not provided'}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-primary to-accent"
                          style={{ width: `${selectedAnomaly.confidence}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                      <div>
                        <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Confidence Score</p>
                        <p className="text-2xl font-bold text-primary">{selectedAnomaly.confidence}%</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Suggested Fix</p>
                        <p className="text-sm font-semibold text-accent">{selectedAnomaly.decisionExplanation || 'No remediation recommendation yet.'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detection Info */}
                <InternalGlassPanel density="compact" className="overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/30 to-transparent" />
                  <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
                  <p className="mb-2 text-xs text-gray-500 dark:text-white/50">Detected</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{new Date(selectedAnomaly.timestamp).toLocaleString()}</p>
                </InternalGlassPanel>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500 dark:text-white/50">
                Select an anomaly to view details
              </div>
            )}
          </InternalGlassPanel>
        </div>
      </div>
    </div>
  );
}
