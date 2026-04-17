'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchAgentAnalyze, type AgentAnalyzeResponse } from '@/lib/agent-analyze';
import { ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'

type IncidentSeverity = 'critical' | 'warning' | 'info';
type IncidentStatus = 'open' | 'resolved';

type DerivedIncident = {
  id: string;
  signature: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedServices: string[];
  rootCause?: string;
  rootCauseSummary: string;
  remediationMethod: 'autonomous' | 'manual' | 'none';
  decisionAction?: string;
  decisionExplanation?: string;
  startedAt: string;
  resolvedAt?: string;
  mttr?: number;
  postmortem?: string;
  timestamp: string;
};

const STORAGE_KEY = 'nova.incidents.derived.v1';

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

const isHealthyAnalyze = (data: AgentAnalyzeResponse) => {
  const services = data.monitoring?.services ?? [];
  const servicesHealthy = services.every((service) => normalize(service.health) === 'healthy' && normalize(service.mode) === 'normal');
  const restartCount = data.kubernetesSignals?.restartCount ?? 0;

  return (
    servicesHealthy &&
    !data.kubernetesSignals?.resourceOverload &&
    restartCount === 0 &&
    !data.rca?.rootCause &&
    !data.decision?.actionNeeded
  );
};

const toSeverity = (data: AgentAnalyzeResponse, affectedServices: string[]): IncidentSeverity => {
  const restartCount = data.kubernetesSignals?.restartCount ?? 0;
  const rcaSeverity = normalize(data.rca?.severity);
  const services = data.monitoring?.services ?? [];
  const hasCriticalService = services.some((service) => {
    const health = normalize(service.health);
    return health === 'critical' || health === 'down' || health === 'error' || health === 'crash';
  });
  const hasWarningMode = services.some((service) => {
    const mode = normalize(service.mode);
    const health = normalize(service.health);
    return mode === 'latency' || mode === 'error' || health === 'degraded' || health === 'warning';
  });

  if (data.kubernetesSignals?.resourceOverload || restartCount >= 2 || rcaSeverity === 'high' || hasCriticalService) {
    return 'critical';
  }
  if (restartCount === 1 || hasWarningMode || data.decision?.actionNeeded || affectedServices.length > 0) {
    return 'warning';
  }
  return 'info';
};

const remediationMethodFromAnalyze = (data: AgentAnalyzeResponse): 'autonomous' | 'manual' | 'none' => {
  const action = normalize(data.decision?.action);
  if (action.includes('heal') || action.includes('scale')) return 'autonomous';
  if (data.decision?.actionNeeded) return 'manual';
  return 'none';
};

const buildIncidentTitle = (data: AgentAnalyzeResponse, severity: IncidentSeverity) => {
  const restartCount = data.kubernetesSignals?.restartCount ?? 0;
  const services = data.monitoring?.services ?? [];
  const hasLatency = services.some((service) => normalize(service.mode) === 'latency');
  const hasError = services.some((service) => normalize(service.mode) === 'error');

  if (data.kubernetesSignals?.resourceOverload) return 'Traffic Overload Detected';
  if (restartCount >= 1) return 'Service Restart Loop';
  if (hasLatency) return 'Latency Spike Detected';
  if (hasError) return 'Error Pattern Detected';
  if (data.rca?.rootCause) return 'Root Cause Identified';
  if (data.decision?.actionNeeded) return 'Remediation Action Required';
  return severity === 'critical' ? 'Critical Service Disruption' : severity === 'warning' ? 'Service Degradation Detected' : 'Operational Deviation Detected';
};

const buildPostmortem = (incident: DerivedIncident) => {
  const svc = incident.affectedServices.length > 0 ? incident.affectedServices.join(', ') : 'the platform';
  const method = incident.remediationMethod === 'autonomous' ? 'automated remediation' : incident.remediationMethod === 'manual' ? 'manual intervention' : 'stabilization controls';
  return `${svc} entered a ${incident.severity} state. Root cause: ${incident.rootCauseSummary}. Recovery was achieved using ${method}.`;
};

const deriveIncidentFromAnalyze = (data: AgentAnalyzeResponse): Omit<DerivedIncident, 'id' | 'startedAt' | 'timestamp' | 'status'> | null => {
  const services = data.monitoring?.services ?? [];
  const abnormalServices = services
    .filter((service) => normalize(service.health) !== 'healthy' || normalize(service.mode) !== 'normal')
    .map((service) => service.service);

  const rootCause = data.rca?.rootCause || '';
  const hasIncident =
    Boolean(data.kubernetesSignals?.resourceOverload) ||
    (data.kubernetesSignals?.restartCount ?? 0) >= 1 ||
    abnormalServices.length > 0 ||
    Boolean(rootCause) ||
    Boolean(data.decision?.actionNeeded);

  if (!hasIncident) return null;

  const affectedServices = Array.from(new Set([...abnormalServices, ...(rootCause ? [rootCause] : [])]));
  const severity = toSeverity(data, affectedServices);
  const title = buildIncidentTitle(data, severity);
  const reason = data.rca?.reason || data.kubernetesSignals?.reason || 'Service behavior deviated from expected baseline.';
  const action = data.decision?.action || 'none';
  const signature = [title, severity, normalize(rootCause), affectedServices.map(normalize).sort().join(','), Boolean(data.kubernetesSignals?.resourceOverload), (data.kubernetesSignals?.restartCount ?? 0) >= 2]
    .join('|');

  return {
    signature,
    title,
    severity,
    affectedServices,
    rootCause: rootCause || undefined,
    rootCauseSummary: reason,
    remediationMethod: remediationMethodFromAnalyze(data),
    decisionAction: action,
    decisionExplanation: data.decision?.explanation,
  };
};

const safeParseIncidents = (): DerivedIncident[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DerivedIncident[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export default function IncidentsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<DerivedIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIncidents(safeParseIncidents());
  }, []);

  useEffect(() => {
    if (incidents.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  }, [incidents]);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const data = await fetchAgentAnalyze();
        if (!isMounted) return;

        setIncidents((prev) => {
          const nowIso = new Date().toISOString();
          const issue = deriveIncidentFromAnalyze(data);
          const openIndex = prev.findIndex((incident) => incident.status === 'open');

          if (!issue) {
            if (openIndex === -1) return prev;

            const next = [...prev];
            const openIncident = next[openIndex];
            const startedMs = new Date(openIncident.startedAt).getTime();
            const resolvedMs = Date.now();
            const mttr = Math.max(1, Math.round((resolvedMs - startedMs) / 60000));

            next[openIndex] = {
              ...openIncident,
              status: 'resolved',
              resolvedAt: nowIso,
              mttr,
              postmortem: buildPostmortem({ ...openIncident, status: 'resolved', resolvedAt: nowIso, mttr }),
              timestamp: nowIso,
            };
            return next;
          }

          if (isHealthyAnalyze(data)) {
            return prev;
          }

          if (openIndex !== -1) {
            const openIncident = prev[openIndex];
            if (openIncident.signature === issue.signature) {
              const next = [...prev];
              next[openIndex] = {
                ...openIncident,
                severity: issue.severity,
                affectedServices: issue.affectedServices,
                rootCause: issue.rootCause,
                rootCauseSummary: issue.rootCauseSummary,
                remediationMethod: issue.remediationMethod,
                decisionAction: issue.decisionAction,
                decisionExplanation: issue.decisionExplanation,
                timestamp: nowIso,
              };
              return next;
            }

            const next = [...prev];
            const startedMs = new Date(openIncident.startedAt).getTime();
            const mttr = Math.max(1, Math.round((Date.now() - startedMs) / 60000));
            next[openIndex] = {
              ...openIncident,
              status: 'resolved',
              resolvedAt: nowIso,
              mttr,
              postmortem: buildPostmortem({ ...openIncident, status: 'resolved', resolvedAt: nowIso, mttr }),
              timestamp: nowIso,
            };

            return [
              {
                id: `inc-${Date.now()}`,
                startedAt: nowIso,
                timestamp: nowIso,
                status: 'open',
                ...issue,
              },
              ...next,
            ];
          }

          return [
            {
              id: `inc-${Date.now()}`,
              startedAt: nowIso,
              timestamp: nowIso,
              status: 'open',
              ...issue,
            },
            ...prev,
          ];
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    poll();
    const timer = window.setInterval(poll, 4000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const avgMTTR = resolvedIncidents.length > 0
    ? Math.round(resolvedIncidents.reduce((sum, i) => sum + (i.mttr || 0), 0) / resolvedIncidents.length)
    : 0;
  const sortedIncidents = useMemo(
    () => [...incidents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [incidents]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Incident History</h1>
          <p className="text-gray-600 dark:text-white/60">Audit trail and post-mortem analysis of resolved incidents</p>
        </div>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <InternalGlassPanel className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Total Incidents</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{incidents.length}</p>
          </InternalGlassPanel>
          <InternalGlassPanel className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Open Incidents</p>
            <p className="text-3xl font-bold text-destructive">{openIncidents.length}</p>
          </InternalGlassPanel>
          <InternalGlassPanel className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-green-500/20 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-green-500/20 blur-[20px] to-transparent" />
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Resolved Incidents</p>
            <p className="text-3xl font-bold text-green-500">{resolvedIncidents.length}</p>
          </InternalGlassPanel>
          <InternalGlassPanel className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Avg MTTR</p>
            <p className="text-3xl font-bold text-accent">{avgMTTR}m</p>
          </InternalGlassPanel>
        </div>

        {/* Incident Table */}
        <InternalGlassPanel>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Incident Audit Trail</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedIncidents.length > 0 ? (
              sortedIncidents.map((incident) => (
                <div key={incident.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                    className="relative w-full rounded-2xl border border-white/10 bg-[#0B1220]/40 p-4 text-left text-gray-900 dark:text-white transition-all hover:border-blue-500/20 hover:bg-blue-500/5"
                  >
                    {/* Premium top-edge glow effect */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 to-transparent" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {incident.status === 'resolved' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <p className="font-semibold text-sm">Incident {incident.id}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${incident.status === 'open' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                            {incident.status.toUpperCase()}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            incident.severity === 'critical'
                              ? 'bg-destructive/20 text-destructive'
                              : incident.severity === 'warning'
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-blue-500/20 text-blue-500'
                          }`}>
                            {incident.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-white/60">
                          {new Date(incident.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {incident.remediationMethod && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-semibold">
                            {incident.remediationMethod === 'autonomous' ? 'AUTO' : 'MANUAL'}
                          </span>
                        )}
                        {incident.mttr && (
                          <span className="text-xs font-semibold text-accent">{incident.mttr}m</span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 text-gray-600 dark:text-white/60 transition-transform ${
                            expandedId === incident.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedId === incident.id && (
                    <InternalGlassPanel
                      density="none"
                      className="rounded-t-none rounded-b-2xl border border-t-0 border-white/10 p-4"
                    >
                      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 to-transparent" />
                      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-blue-400/20 blur-[20px] to-transparent" />
                      {incident.rootCause && (
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-900 dark:text-white">ROOT CAUSE</p>
                          <p className="text-sm text-gray-600 dark:text-white/60">{incident.rootCause}</p>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-900 dark:text-white">ROOT CAUSE SUMMARY</p>
                        <p className="text-sm text-gray-600 dark:text-white/60">{incident.rootCauseSummary}</p>
                      </div>

                      {incident.affectedServices.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-900 dark:text-white">AFFECTED SERVICES</p>
                          <div className="flex flex-wrap gap-2">
                            {incident.affectedServices.map((svc) => (
                              <span key={svc} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                                {svc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Action Taken</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{incident.decisionAction || 'none'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Remediation Method</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase">{incident.remediationMethod}</p>
                        </div>
                      </div>

                      {incident.decisionExplanation && (
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-900 dark:text-white">DECISION EXPLANATION</p>
                          <p className="text-sm text-gray-600 dark:text-white/60">{incident.decisionExplanation}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Start Time</p>
                          <p className="text-sm font-semibold">{new Date(incident.startedAt).toLocaleString()}</p>
                        </div>
                        {incident.resolvedAt && (
                          <div>
                            <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Resolution Time</p>
                            <p className="text-sm font-semibold">{new Date(incident.resolvedAt).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      {incident.postmortem && (
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-900 dark:text-white">POST-MORTEM</p>
                          <p className="text-sm leading-relaxed text-gray-600 dark:text-white/60">{incident.postmortem}</p>
                        </div>
                      )}
                    </InternalGlassPanel>
                  )}
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-gray-600 dark:text-white/60">{loading ? 'Analyzing incident signals...' : 'No incidents recorded'}</p>
            )}
          </div>
        </InternalGlassPanel>
      </div>
    </div>
  );
}
