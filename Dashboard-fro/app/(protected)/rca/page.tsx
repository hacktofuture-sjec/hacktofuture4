'use client';

import React, { useMemo } from 'react';
import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
import { resolveMlData } from '@/lib/agent-analyze';
import { ChevronDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';

export default function RCAPage() {
  const { data, loading, error, lastUpdated } = useAgentAnalyze(4000);

  const monitoring = data?.monitoring;
  const rca = data?.rca;
  const decision = data?.decision;
  const kubernetesSignals = data?.kubernetesSignals;
  const mlResolved = resolveMlData(data);

  const normalizedSeverity = (rca?.severity || 'low').toLowerCase();
  const hasRootCause = Boolean(rca?.rootCause);

  const severityColor =
    normalizedSeverity === 'critical' || normalizedSeverity === 'high'
      ? 'text-red-500'
      : normalizedSeverity === 'medium'
        ? 'text-yellow-500'
        : 'text-blue-400';

  const severityBadge =
    normalizedSeverity === 'critical' || normalizedSeverity === 'high'
      ? 'bg-red-500/20 text-red-500'
      : normalizedSeverity === 'medium'
        ? 'bg-yellow-500/20 text-yellow-500'
        : 'bg-blue-500/20 text-blue-400';

  const incidentStatus = hasRootCause
    ? decision?.actionNeeded
      ? 'HEALING'
      : 'ACTIVE INCIDENT'
    : 'NO ACTIVE INCIDENT';

  const incidentStatusClass = hasRootCause
    ? decision?.actionNeeded
      ? 'bg-yellow-500/20 text-yellow-500'
      : 'bg-red-500/20 text-red-500'
    : 'bg-green-500/20 text-green-500';

  const chainNodes = useMemo(() => {
    const sequence = ['frontend', 'auth-service', 'messaging-service', 'presence-service'];
    const root = (rca?.rootCause || '').toLowerCase();
    const rootIndex = sequence.findIndex((entry) => entry === root);
    const services = monitoring?.services || [];

    const nodeStatus = (name: string, index: number) => {
      const serviceState = services.find((entry) => entry.service === name);
      const health = (serviceState?.health || '').toLowerCase();

      if (root && name === root) return 'critical';
      if (rootIndex >= 0 && index < rootIndex) return 'affected';
      if (health === 'critical' || health === 'down') return 'critical';
      if (health === 'degraded') return 'affected';
      if (name === 'messaging-service' && kubernetesSignals?.resourceOverload) return 'critical';
      return 'healthy';
    };

    const statusClass = (status: string) => {
      if (status === 'critical') return 'border-red-500/40 bg-red-500/15 text-red-400';
      if (status === 'affected') return 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300';
      return 'border-green-500/30 bg-green-500/10 text-green-400';
    };

    return sequence.map((name, index) => {
      const status = nodeStatus(name, index);
      return {
        name,
        status,
        className: statusClass(status)
      };
    });
  }, [monitoring?.services, rca?.rootCause, kubernetesSignals?.resourceOverload]);

  const evidenceLines = useMemo(() => {
    const lines: string[] = [];
    const evidence = rca?.evidence;

    if (evidence && typeof evidence === 'object') {
      Object.entries(evidence).forEach(([key, value]) => {
        lines.push(`${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
      });
    }

    if (typeof kubernetesSignals?.restartCount === 'number') {
      lines.push(`restartCount: ${kubernetesSignals.restartCount}`);
    }

    if ((kubernetesSignals?.detectedKeywords || []).length > 0) {
      lines.push(`detectedKeywords: ${(kubernetesSignals?.detectedKeywords || []).join(', ')}`);
    }

    return lines;
  }, [rca?.evidence, kubernetesSignals?.restartCount, kubernetesSignals?.detectedKeywords]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Root Cause Analysis</h1>
          <p className="text-gray-600 dark:text-white/60">Automatic incident investigation and failure chain analysis</p>
        </div>

        {/* Incident Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GlowCard glowColor="blue" customSize={true} className="p-4">
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Root Cause Service</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{rca?.rootCause || 'none'}</p>
          </GlowCard>
          <GlowCard glowColor="red" customSize={true} className="p-4">
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Severity</p>
            <p className={`text-3xl font-bold uppercase ${severityColor}`}>{normalizedSeverity}</p>
          </GlowCard>
          <GlowCard glowColor="green" customSize={true} className="p-4">
            <p className="mb-1 text-sm text-gray-600 dark:text-white/60">Incident Status</p>
            <p className={`text-xl font-bold ${hasRootCause ? 'text-red-500' : 'text-green-500'}`}>{incidentStatus}</p>
          </GlowCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incident List */}
          <GlowCard glowColor="purple" customSize={true} className="lg:col-span-1 p-3">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Live RCA Feed</h2>
            <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
              {loading ? (
                <div className="rounded-lg border border-white/10 p-4 text-sm text-gray-600 dark:text-white/60">Loading RCA stream...</div>
              ) : (
                <div className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left dark:border-white/10 dark:bg-[#0B1220]/40">
                  <div className="flex items-start gap-2">
                    {hasRootCause ? (
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{rca?.rootCause || 'No active incident detected'}</p>
                      <p className="text-xs text-gray-600 dark:text-white/60 truncate">{lastUpdated ? lastUpdated.toLocaleTimeString() : 'No telemetry yet'}</p>
                      <p className="text-xs capitalize mt-1">{incidentStatus.toLowerCase()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlowCard>

          {/* RCA Details */}
          <GlowCard glowColor="orange" customSize={true} className="lg:col-span-2 p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-600 dark:text-white/60">
                Loading real-time RCA...
              </div>
            ) : hasRootCause ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Incident Analysis</h2>
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      {lastUpdated ? lastUpdated.toLocaleString() : new Date().toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${incidentStatusClass}`}
                  >
                    {incidentStatus}
                  </span>
                </div>

                {/* Root Cause */}
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Root Cause</h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-white/60">{rca?.reason || 'No reason available'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-3">
                    <p className="text-xs text-gray-600 dark:text-white/60">Root Cause Type</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{rca?.rootCauseType || 'runtime'}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-3">
                    <p className="text-xs text-gray-600 dark:text-white/60">Severity</p>
                    <p className={`text-sm font-semibold uppercase ${severityColor}`}>{normalizedSeverity}</p>
                  </div>
                </div>

                {/* Failure Propagation Map */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Failure Propagation Chain</h3>
                  <div className="space-y-3">
                    {chainNodes.map((hop, idx) => (
                      <div key={`${hop.name}-${idx}`}>
                        <div className={`rounded-2xl border p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${hop.className}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold">{hop.name}</p>
                              <p className="text-xs mt-1 capitalize">{hop.status}</p>
                            </div>
                          </div>
                        </div>
                        {idx < chainNodes.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-white/60" />
                          </div>
                        )}
                      </div>
                    ))}
                    <div className={`rounded-2xl border p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${severityBadge}`}>
                      <p className="text-sm font-semibold">root-cause-type</p>
                      <p className="text-xs mt-1">{rca?.rootCauseType || 'runtime'}</p>
                    </div>
                  </div>
                </div>

                {/* Evidence Summary */}
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Evidence Summary</h3>
                  {evidenceLines.length > 0 ? (
                    <div className="space-y-1">
                      {evidenceLines.map((line, index) => (
                        <p key={`${line}-${index}`} className="text-sm text-gray-600 dark:text-white/60">{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-white/60">No additional evidence provided.</p>
                  )}
                </div>

                {/* AI Insight */}
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <h4 className="font-semibold text-sm mb-2">AI Insight</h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600 dark:text-white/60">{rca?.reason || 'No RCA reason available.'}</p>
                    <p className="text-gray-600 dark:text-white/60">{decision?.explanation || 'No remediation explanation provided.'}</p>
                  </div>
                </div>

                {/* ML-Assisted Signal */}
                <div className={`p-3 rounded-lg border ${mlResolved.anomaly ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                  <h4 className="font-semibold text-sm mb-2">ML-Assisted Signal</h4>
                  {!mlResolved.available ? (
                    <p className="text-sm text-gray-600 dark:text-white/60">ML data not available.</p>
                  ) : (
                    <div className="space-y-2 text-sm text-gray-600 dark:text-white/70">
                      <p>
                        Model status:{' '}
                        <span className={`font-semibold ${mlResolved.anomaly ? 'text-red-400' : 'text-emerald-400'}`}>
                          {mlResolved.anomaly ? 'Anomaly detected' : 'Normal behavior'}
                        </span>
                      </p>
                      <p>
                        Confidence:{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {typeof mlResolved.confidence === 'number' ? `${(mlResolved.confidence * 100).toFixed(1)}%` : '—'}
                        </span>
                      </p>
                      <p>
                        Service:{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{mlResolved.service || 'unknown'}</span>
                      </p>
                      <p>{mlResolved.reason || 'No ML reasoning provided.'}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 dark:text-white/60">
                {error ? `Failed to load RCA: ${error}` : 'No active incidents detected'}
              </div>
            )}
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
