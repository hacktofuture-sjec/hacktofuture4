'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'
import { executeHeal, executeScaleHeal, fetchRemediationAnalyze } from '@/lib/remediation-api';
import { AgentAnalyzeResponse } from '@/lib/agent-analyze';

type RemediationMode = 'manual' | 'autonomous';
type LogLevel = 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR';

type ExecutionRecord = {
  at: Date;
  success: boolean;
  message: string;
  action: string;
};

export default function RemediationPage() {
  const [mode, setMode] = useState<RemediationMode>('manual');
  const [analyze, setAnalyze] = useState<AgentAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionRecord, setExecutionRecord] = useState<ExecutionRecord | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const lastDigestRef = useRef<string | null>(null);
  const lastAutoKeyRef = useRef<string | null>(null);

  const appendLog = useCallback((level: LogLevel, message: string) => {
    const entry = `[${new Date().toLocaleTimeString()}] [${level}] ${message}`;
    setLogs((prev) => [entry, ...prev].slice(0, 150));
  }, []);

  const refreshAnalyze = useCallback(async () => {
    try {
      const next = await fetchRemediationAnalyze();
      setAnalyze(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch remediation analyze data');
      appendLog('ERROR', err instanceof Error ? err.message : 'Failed to fetch remediation analyze data');
    } finally {
      setLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    refreshAnalyze();
    const timer = setInterval(refreshAnalyze, 4000);
    return () => clearInterval(timer);
  }, [refreshAnalyze]);

  const rca = analyze?.rca;
  const decision = analyze?.decision;
  const monitoring = analyze?.monitoring;
  const hasIssue = Boolean(rca?.rootCause);

  const recommendationText = useMemo(() => {
    if (!hasIssue) return 'No active issues detected.';

    const action = decision?.action || 'none';
    const target = decision?.target || rca?.rootCause || 'unknown-service';
    return `${target} is affected (${rca?.rootCauseType || 'runtime'}). Recommended action: ${action}.`;
  }, [decision?.action, decision?.target, hasIssue, rca?.rootCause, rca?.rootCauseType]);

  const severityLevel = (rca?.severity || 'low').toLowerCase();
  const severityClass =
    severityLevel === 'critical' || severityLevel === 'high'
      ? 'text-red-500'
      : severityLevel === 'medium'
        ? 'text-yellow-500'
        : 'text-blue-400';

  const remediationStatus = hasIssue
    ? decision?.actionNeeded
      ? executing
        ? 'ACTION RUNNING'
        : 'HEALING REQUIRED'
      : 'ACTIVE INCIDENT'
    : 'HEALTHY';

  const executeFix = useCallback(async (triggeredBy: 'manual' | 'autonomous') => {
    if (executing || !decision?.actionNeeded) {
      return;
    }

    setExecuting(true);
    appendLog('INFO', `Issue detected in ${rca?.rootCause || 'unknown-service'}`);
    appendLog('INFO', `RCA completed: ${rca?.reason || 'no reason provided'}`);
    appendLog('INFO', `Decision: ${decision?.action || 'none'} on ${decision?.target || 'n/a'}`);

    const shouldScale = decision?.action === 'SCALE_DEPLOYMENT';

    try {
      appendLog('ACTION', shouldScale ? 'Calling /agent/scale-heal' : 'Calling /agent/heal');
      const result = shouldScale ? await executeScaleHeal() : await executeHeal();
      const success = Boolean(
        result?.success !== false
          && result?.remediation_success !== false
          && result?.remediation?.success !== false
      );

      const message =
        result?.remediation?.message
        || result?.message
        || result?.root_cause_analysis
        || (success ? 'Remediation executed successfully.' : 'Remediation failed.');

      appendLog(success ? 'SUCCESS' : 'ERROR', message);

      if (shouldScale && typeof result?.new_replicas === 'number') {
        appendLog('INFO', `Replicas changed to ${result.new_replicas} (previous ${result.previous_replicas ?? 'unknown'}).`);
      }

      setExecutionRecord({
        at: new Date(),
        success,
        message: `${triggeredBy.toUpperCase()}: ${message}`,
        action: shouldScale ? 'SCALE_DEPLOYMENT' : 'HEAL'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Remediation execution failed.';
      appendLog('ERROR', message);
      setExecutionRecord({
        at: new Date(),
        success: false,
        message: `${triggeredBy.toUpperCase()}: ${message}`,
        action: decision?.action || 'unknown'
      });
    } finally {
      setExecuting(false);
      await refreshAnalyze();
    }
  }, [appendLog, decision?.action, decision?.actionNeeded, decision?.target, executing, rca?.reason, rca?.rootCause, refreshAnalyze]);

  useEffect(() => {
    const digest = JSON.stringify({
      rootCause: rca?.rootCause,
      severity: rca?.severity,
      actionNeeded: decision?.actionNeeded,
      action: decision?.action,
      target: decision?.target,
      overall: monitoring?.overall
    });

    if (lastDigestRef.current !== digest) {
      if (hasIssue) {
        appendLog('INFO', `Issue detected: ${rca?.rootCause || 'unknown'} (${rca?.severity || 'low'})`);
      } else {
        appendLog('INFO', 'No active issue detected by analyzer.');
      }
      lastDigestRef.current = digest;
    }
  }, [appendLog, decision?.action, decision?.actionNeeded, decision?.target, hasIssue, monitoring?.overall, rca?.rootCause, rca?.severity]);

  useEffect(() => {
    if (mode !== 'autonomous' || executing || !decision?.actionNeeded) {
      return;
    }

    const autoKey = `${rca?.rootCause || 'none'}|${decision?.action || 'none'}|${decision?.target || 'none'}|${rca?.severity || 'low'}`;

    if (lastAutoKeyRef.current === autoKey) {
      return;
    }

    lastAutoKeyRef.current = autoKey;
    appendLog('ACTION', 'Autonomous mode executing recommended fix.');
    executeFix('autonomous');
  }, [appendLog, decision?.action, decision?.actionNeeded, decision?.target, executeFix, executing, mode, rca?.rootCause, rca?.severity]);

  useEffect(() => {
    if (!decision?.actionNeeded || !rca?.rootCause) {
      lastAutoKeyRef.current = null;
    }
  }, [decision?.actionNeeded, rca?.rootCause]);

  const workflowState = {
    detection: hasIssue || Boolean(monitoring),
    diagnosis: Boolean(rca?.reason),
    action: executing ? 'running' : decision?.actionNeeded ? 'ready' : 'complete',
    recovery: !hasIssue && monitoring?.overall === 'healthy'
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Remediation Center</h1>
          <p className="text-gray-600 dark:text-white/60">Operational bridge between AI intelligence and infrastructure actions</p>
        </div>

        {/* Mode Switching */}
        <InternalGlassPanel>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Execution Mode</h2>
              <p className="text-sm text-gray-600 dark:text-white/60">Toggle between manual (requires approval) and autonomous execution</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`rounded-lg px-6 py-2 font-semibold transition-all ${
                  mode === 'manual'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-transparent dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode('autonomous')}
                className={`rounded-lg px-6 py-2 font-semibold transition-all ${
                  mode === 'autonomous'
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-transparent dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                }`}
              >
                Autonomous
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-600 dark:text-white/60">
            Current Mode: <span className="font-semibold capitalize text-gray-900 dark:text-white">{mode}</span>
            <span className="ml-3">Status: <span className="font-semibold text-gray-900 dark:text-white">{remediationStatus}</span></span>
            <span className="ml-3">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for telemetry'}</span>
          </p>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </InternalGlassPanel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* AI Recommended Actions */}
          <InternalGlassPanel className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">AI Recommended Actions</h2>
            <div className="space-y-4">
              <InternalGlassPanel
                density="compact"
                className="transition-all hover:shadow-[0_10px_36px_rgba(0,0,0,0.34)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {recommendationText}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-white/60">
                      {rca?.reason || 'No active incident reason.'}
                    </p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                      Action Needed: <span className="font-semibold text-gray-900 dark:text-white">{decision?.actionNeeded ? 'true' : 'false'}</span> | Action: <span className="font-semibold text-gray-900 dark:text-white">{decision?.action || 'none'}</span> | Target: <span className="font-semibold text-gray-900 dark:text-white">{decision?.target || 'n/a'}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                      Severity: <span className={`font-semibold uppercase ${severityClass}`}>{severityLevel}</span> | Root Cause Type: <span className="font-semibold capitalize text-gray-900 dark:text-white">{rca?.rootCauseType || 'runtime'}</span>
                    </p>
                  </div>
                </div>

                {mode === 'manual' && (
                  <button
                    onClick={() => executeFix('manual')}
                    disabled={executing || !decision?.actionNeeded}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Play size={16} />
                    {executing ? 'Executing...' : 'Execute Fix'}
                  </button>
                )}
                {mode === 'autonomous' && (
                  <p className="mt-3 text-xs text-gray-600 dark:text-white/60">
                    Autonomous mode will execute recommended action automatically when actionNeeded is true.
                  </p>
                )}
              </InternalGlassPanel>
            </div>
          </InternalGlassPanel>

          {/* Workflow Engine Tracker */}
          <InternalGlassPanel>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Workflow Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {workflowState.detection ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Detection</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.detection ? 'Anomaly identified' : 'Waiting for telemetry'}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  {workflowState.diagnosis ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Diagnosis</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.diagnosis ? 'Root cause analyzed' : 'RCA pending'}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  {workflowState.action === 'running' ? <Zap className="h-5 w-5 text-yellow-500" /> : workflowState.action === 'ready' ? <AlertCircle className="h-5 w-5 text-yellow-500" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Action</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-white/60 ml-7">
                  {workflowState.action === 'running' ? 'Executing remediation' : workflowState.action === 'ready' ? 'Awaiting execution' : 'Action completed'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  {workflowState.recovery ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Zap className="h-5 w-5 text-gray-600 dark:text-white/60" />}
                  <span className={`text-sm font-semibold ${workflowState.recovery ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/60'}`}>Recovery</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.recovery ? 'System stabilized' : 'Awaiting healthy state'}</p>
              </div>
            </div>
          </InternalGlassPanel>
        </div>

        {/* Execution Logs */}
        <InternalGlassPanel>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Agentic Execution Logs</h2>
          <InternalGlassPanel density="compact" className="h-80 space-y-1 overflow-y-auto font-mono text-xs">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div key={idx} className="text-gray-600 dark:text-white/60">
                  {log}
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-gray-600 dark:text-white/60">
                No execution logs yet
              </div>
            )}
          </InternalGlassPanel>
        </InternalGlassPanel>

        {/* Completed Actions */}
        <InternalGlassPanel>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Completed Remediations</h2>
          <div className="space-y-3">
            {executionRecord ? (
              <InternalGlassPanel
                density="compact"
                className={executionRecord.success ? 'border-green-500/25 bg-black/25' : 'border-red-500/25 bg-black/25'}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${executionRecord.success ? 'text-green-500' : 'text-red-500'}`} />
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{executionRecord.action}</p>
                    <p className="mb-2 text-xs text-gray-600 dark:text-white/60">{executionRecord.message}</p>
                    <p className="text-xs text-gray-600 dark:text-white/60">
                      Completed at {executionRecord.at.toLocaleString()}
                    </p>
                  </div>
                </div>
              </InternalGlassPanel>
            ) : (
              <p className="text-sm text-gray-600 dark:text-white/60 text-center py-8">No completed remediations</p>
            )}
          </div>
        </InternalGlassPanel>
      </div>
    </div>
  );
}
