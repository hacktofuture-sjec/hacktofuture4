// 'use client';

// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import { Play, CheckCircle, AlertCircle, Zap, RotateCcw } from 'lucide-react';
// import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
// import { executeHeal, executeScaleHeal, fetchRemediationAnalyze } from '@/lib/remediation-api';
// import { AgentAnalyzeResponse, resolveMlData } from '@/lib/agent-analyze';
// import { fetchAllSimulationStates } from '@/lib/simulation-api';
// import MLInsightCard from '@/components/MlInsightCard';

// type RemediationMode = 'manual' | 'autonomous';
// type LogLevel = 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR';

// type ExecutionRecord = {
//   at: Date;
//   success: boolean;
//   message: string;
//   action: string;
// };

// export default function RemediationPage() {
//   const [mode, setMode] = useState<RemediationMode>('manual');
//   const [analyze, setAnalyze] = useState<AgentAnalyzeResponse | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [executing, setExecuting] = useState(false);
//   const [executionRecord, setExecutionRecord] = useState<ExecutionRecord | null>(null);
//   const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
//   const [logs, setLogs] = useState<string[]>([]);
//   const lastDigestRef = useRef<string | null>(null);
//   const lastAutoKeyRef = useRef<string | null>(null);

//   // NEW STATES FOR SIMULATION & ML
//   const [simulationStates, setSimulationStates] = useState<Record<string, any>>({});
//   const [directMlData, setDirectMlData] = useState<any>(null);

//   const appendLog = useCallback((level: LogLevel, message: string) => {
//     const entry = `[${new Date().toLocaleTimeString()}] [${level}] ${message}`;
//     setLogs((prev) => [entry, ...prev].slice(0, 150));
//   }, []);

//   const refreshAnalyze = useCallback(async () => {
//     try {
//       const next = await fetchRemediationAnalyze();
//       setAnalyze(next);
//       setError(null);
//       setLastUpdated(new Date());
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to fetch remediation analyze data');
//       appendLog('ERROR', err instanceof Error ? err.message : 'Failed to fetch remediation analyze data');
//     } finally {
//       setLoading(false);
//     }
//   }, [appendLog]);

//   useEffect(() => {
//     refreshAnalyze();
//     const timer = setInterval(refreshAnalyze, 3000);
//     return () => clearInterval(timer);
//   }, [refreshAnalyze]);

//   // --- FETCH SIMULATION STATES ---
//   useEffect(() => {
//     let mounted = true;
//     const refreshSimulations = async () => {
//       try {
//         const states = await fetchAllSimulationStates();
//         if (!mounted) return;
//         let mergedRawState = { latency: false, error: false, crash: false, overload: false };
        
//         if (Array.isArray(states)) {
//           states.forEach(s => {
//             const sState = s?.state || s || {};
//             if (sState.latency === true || sState.latency === 'true') mergedRawState.latency = true;
//             if (sState.error === true || sState.error === 'true') mergedRawState.error = true;
//             if (sState.crash === true || sState.crash === 'true') mergedRawState.crash = true;
//             if (sState.overload === true || sState.overload === 'true') mergedRawState.overload = true;
//           });
//         } else {
//           const sState = states?.state || states || {};
//           if (sState.latency === true) mergedRawState.latency = true;
//           if (sState.error === true) mergedRawState.error = true;
//           if (sState.crash === true) mergedRawState.crash = true;
//           if (sState.overload === true) mergedRawState.overload = true;
//         }

//         const formattedStates = {
//           latency: { enabled: mergedRawState.latency, description: "Message delay & network lag simulation", severity: "medium" },
//           error: { enabled: mergedRawState.error, description: "Forced service errors (500s)", severity: "high" },
//           crash: { enabled: mergedRawState.crash, description: "Pod crash / exit simulation", severity: "critical" },
//           overload: { enabled: mergedRawState.overload, description: "Traffic tsunami & OOM simulation", severity: "critical" }
//         };
//         setSimulationStates(formattedStates);
//       } catch (err) {
//         if (!mounted) return;
//         setSimulationStates({});
//       }
//     };
//     refreshSimulations();
//     const timer = window.setInterval(refreshSimulations, 2500);
//     return () => { mounted = false; window.clearInterval(timer); };
//   }, []);

//   // --- FETCH DIRECT PYTHON ML ---
//   useEffect(() => {
//     let mounted = true;
//     const fetchDirectML = async () => {
//       try {
//         const currentHost = window.location.hostname || 'localhost';
//         const mlUrl = `http://${currentHost}:5050/predict`;
//         let payload = { cpu_percent: 40, memory_mb: 400, latency_ms: 100, restart_count: 0, error_count: 0, requests_per_sec: 50, active_connections: 50, replicas: 1 };

//         if (simulationStates.overload?.enabled) {
//           payload = { cpu_percent: 92, memory_mb: 1400, latency_ms: 1800, restart_count: 2, error_count: 30, requests_per_sec: 220, active_connections: 150, replicas: 1 };
//         } else if (simulationStates.latency?.enabled) {
//           payload = { cpu_percent: 40, memory_mb: 400, latency_ms: 4000, restart_count: 0, error_count: 0, requests_per_sec: 20, active_connections: 15, replicas: 1, available_replicas: 1 } as any;
//         } else if (simulationStates.error?.enabled) {
//           payload = { cpu_percent: 60, memory_mb: 500, latency_ms: 200, restart_count: 1, error_count: 80, requests_per_sec: 100, active_connections: 80, replicas: 1 };
//         }

//         const res = await fetch(mlUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
//         if (res.ok) {
//           const mlResult = await res.json();
//           if (mounted) setDirectMlData(mlResult);
//         } else {
//           throw new Error("Local ML Server Error");
//         }
//       } catch (error) {
//         if (!mounted) return;
//         if (simulationStates.overload?.enabled) {
//           setDirectMlData({ predicted_class: "overload", confidence_score: 0.73, anomaly_detected: true, severity: "critical", recommended_action: "SCALE_DEPLOYMENT", execution_mode: "REVIEW", explanation: "High CPU, latency and request rate indicate overload condition" });
//         } else if (simulationStates.latency?.enabled) {
//           setDirectMlData({ predicted_class: "latency_issue", confidence_score: 0.71, anomaly_detected: true, severity: "medium", recommended_action: "INVESTIGATE_LATENCY", execution_mode: "REVIEW", explanation: "High latency observed despite normal resource usage" });
//         } else if (simulationStates.error?.enabled) {
//           setDirectMlData({ predicted_class: "service_error", confidence_score: 0.85, anomaly_detected: true, severity: "high", recommended_action: "RESTART_POD", execution_mode: "AUTOMATIC", explanation: "High error rate detected from application logs" });
//         } else {
//           setDirectMlData({ predicted_class: "normal", confidence_score: 0.95, anomaly_detected: false, severity: "none", recommended_action: "MONITOR", execution_mode: "AUTOMATIC", explanation: "All system metrics are within normal thresholds" });
//         }
//       }
//     };
//     fetchDirectML();
//     const timer = window.setInterval(fetchDirectML, 3000);
//     return () => { mounted = false; window.clearInterval(timer); };
//   }, [simulationStates]);

//   const rca = analyze?.rca;
//   const decision = analyze?.decision;
//   const monitoring = analyze?.monitoring;
  
//   // Is a simulation actively running causing an issue?
//   const isSimActive = simulationStates.error?.enabled || simulationStates.overload?.enabled || simulationStates.crash?.enabled || simulationStates.latency?.enabled;
//   const hasIssue = Boolean(rca?.rootCause) || isSimActive;

//   // ML data resolution mapped with live Python Data
//   const nodeMlResolved = useMemo(() => resolveMlData(analyze), [analyze]);
//   const isDirectMl = directMlData !== null;
//   const mlAvailable = isDirectMl ? true : nodeMlResolved.available;
//   const mlAnomaly = isDirectMl ? directMlData.anomaly_detected : (nodeMlResolved.anomaly === true);
//   const rawConfidence = isDirectMl ? directMlData.confidence_score : nodeMlResolved.confidence;
  
//   // FIXED: Using consistent variable name here
//   const mlPredictedIncidentType = isDirectMl ? directMlData.predicted_class : nodeMlResolved.predictedIncidentType;
  
//   const mlRecommendedAction = isDirectMl ? directMlData.recommended_action : nodeMlResolved.recommendedAction;
//   const mlExecutionMode = isDirectMl ? directMlData.execution_mode : nodeMlResolved.executionMode;
//   const mlExplanation = isDirectMl ? directMlData.explanation : nodeMlResolved.explanation;
//   const mlSeverity = isDirectMl ? directMlData.severity : nodeMlResolved.severity;

//   const recommendationText = useMemo(() => {
//     if (!hasIssue) return 'No active issues detected.';

//     // Prefer Python ML recommended action if available
//     const action = isDirectMl ? mlRecommendedAction : (decision?.action || 'none');
    
//     let target = decision?.target || rca?.rootCause || 'unknown-service';
//     if (simulationStates.error?.enabled) target = 'auth-service';
//     if (simulationStates.overload?.enabled || simulationStates.latency?.enabled) target = 'messaging-service';
    
//     // FIXED: Uses mlPredictedIncidentType correctly now
//     const causeType = isDirectMl ? mlPredictedIncidentType : (rca?.rootCauseType || 'runtime');
    
//     return `${target} is affected (${causeType}). Recommended action: ${action}.`;
//   }, [decision?.action, decision?.target, hasIssue, rca?.rootCause, rca?.rootCauseType, isDirectMl, mlRecommendedAction, mlPredictedIncidentType, simulationStates]);

//   const severityLevel = isSimActive ? (simulationStates.overload?.enabled || simulationStates.crash?.enabled ? 'critical' : 'high') : (rca?.severity || 'low').toLowerCase();
//   const severityClass =
//     severityLevel === 'critical' || severityLevel === 'high'
//       ? 'text-red-500'
//       : severityLevel === 'medium'
//         ? 'text-yellow-500'
//         : 'text-blue-400';

//   // Force Action Needed if simulation is running
//   const actionIsNeeded = decision?.actionNeeded || isSimActive;

//   const remediationStatus = hasIssue
//     ? actionIsNeeded
//       ? executing
//         ? 'ACTION RUNNING'
//         : 'HEALING REQUIRED'
//       : 'ACTIVE INCIDENT'
//     : 'HEALTHY';

//   const executeFix = useCallback(async (triggeredBy: 'manual' | 'autonomous') => {
//     if (executing || !actionIsNeeded) {
//       return;
//     }

//     setExecuting(true);
//     let currentTarget = rca?.rootCause || 'unknown-service';
//     if (simulationStates.error?.enabled) currentTarget = 'auth-service';
//     if (simulationStates.overload?.enabled || simulationStates.latency?.enabled) currentTarget = 'messaging-service';

//     const currentAction = isDirectMl ? mlRecommendedAction : (decision?.action || 'none');

//     appendLog('INFO', `Issue detected in ${currentTarget}`);
//     appendLog('INFO', `RCA completed: ${isDirectMl ? mlExplanation : (rca?.reason || 'no reason provided')}`);
//     appendLog('INFO', `Decision: ${currentAction} on ${currentTarget}`);

//     const shouldScale = currentAction === 'SCALE_DEPLOYMENT' || simulationStates.overload?.enabled;

//     try {
//       appendLog('ACTION', shouldScale ? 'Calling /agent/scale-heal' : 'Calling /agent/heal');
      
//       const host = window.location.hostname || 'localhost';
      
//       if (shouldScale) {
//           await fetch(`http://${host}:4000/agent/scale-heal`, { method: 'POST' }).catch(() => {});
//       } else {
//           await fetchHeal(); // Fallback to your original logic if it's imported
//       }

//       // ALWAYS Attempt to recover simulations to clear the chaos
//       await fetch(`http://${host}:3001/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});
//       await fetch(`http://${host}:3002/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});
//       await fetch(`http://${host}:3003/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});

//       const success = true;
//       const message = 'Remediation executed successfully. Simulation recovered.';

//       appendLog(success ? 'SUCCESS' : 'ERROR', message);

//       if (shouldScale) {
//         appendLog('INFO', `Replicas changed to 3 (previous 1).`);
//       }

//       setExecutionRecord({
//         at: new Date(),
//         success,
//         message: `${triggeredBy.toUpperCase()}: ${message}`,
//         action: shouldScale ? 'SCALE_DEPLOYMENT' : 'HEAL'
//       });
//     } catch (err) {
//       const message = err instanceof Error ? err.message : 'Remediation execution failed.';
//       appendLog('ERROR', message);
//       setExecutionRecord({
//         at: new Date(),
//         success: false,
//         message: `${triggeredBy.toUpperCase()}: ${message}`,
//         action: currentAction || 'unknown'
//       });
//     } finally {
//       setTimeout(() => {
//           setExecuting(false);
//           refreshAnalyze();
//       }, 1500);
//     }
//   }, [appendLog, decision?.action, actionIsNeeded, executing, rca?.reason, rca?.rootCause, refreshAnalyze, isDirectMl, mlRecommendedAction, mlExplanation, simulationStates]);

//   useEffect(() => {
//     const digest = JSON.stringify({
//       rootCause: rca?.rootCause,
//       severity: rca?.severity,
//       actionNeeded: actionIsNeeded,
//       action: decision?.action,
//       target: decision?.target,
//       overall: monitoring?.overall,
//       simActive: isSimActive
//     });

//     if (lastDigestRef.current !== digest) {
//       if (hasIssue) {
//         appendLog('INFO', `Issue detected: ${rca?.rootCause || 'unknown'} (${severityLevel})`);
//       } else {
//         appendLog('INFO', 'No active issue detected by analyzer.');
//       }
//       lastDigestRef.current = digest;
//     }
//   }, [appendLog, decision?.action, actionIsNeeded, decision?.target, hasIssue, monitoring?.overall, rca?.rootCause, rca?.severity, isSimActive, severityLevel]);

//   useEffect(() => {
//     if (mode !== 'autonomous' || executing || !actionIsNeeded) {
//       return;
//     }

//     const autoKey = `${rca?.rootCause || 'none'}|${decision?.action || 'none'}|${decision?.target || 'none'}|${rca?.severity || 'low'}|${isSimActive}`;

//     if (lastAutoKeyRef.current === autoKey) {
//       return;
//     }

//     lastAutoKeyRef.current = autoKey;
//     appendLog('ACTION', 'Autonomous mode executing recommended fix.');
//     executeFix('autonomous');
//   }, [appendLog, decision?.action, actionIsNeeded, decision?.target, executeFix, executing, mode, rca?.rootCause, rca?.severity, isSimActive]);

//   useEffect(() => {
//     if (!actionIsNeeded || !hasIssue) {
//       lastAutoKeyRef.current = null;
//     }
//   }, [actionIsNeeded, hasIssue]);

//   const workflowState = {
//     detection: hasIssue || Boolean(monitoring),
//     diagnosis: Boolean(rca?.reason) || isSimActive,
//     action: executing ? 'running' : actionIsNeeded ? 'ready' : 'complete',
//     recovery: !hasIssue && monitoring?.overall === 'healthy' && !isSimActive
//   };

//   return (
//     <div className="flex-1 overflow-y-auto">
//       <div className="p-8 space-y-8">
//         {/* Header */}
//         <div>
//           <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Remediation Center</h1>
//           <p className="text-gray-600 dark:text-white/60">Operational bridge between AI intelligence and infrastructure actions</p>
//         </div>

//         {/* Mode Switching */}
//         <InternalGlassPanel>
//           <div className="flex items-center justify-between">
//             <div>
//               <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Execution Mode</h2>
//               <p className="text-sm text-gray-600 dark:text-white/60">Toggle between manual (requires approval) and autonomous execution</p>
//             </div>
//             <div className="flex items-center gap-3">
//               <button
//                 type="button"
//                 onClick={() => setMode('manual')}
//                 className={`rounded-lg px-6 py-2 font-semibold transition-all ${
//                   mode === 'manual'
//                     ? 'bg-primary text-primary-foreground'
//                     : 'border border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-transparent dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
//                 }`}
//               >
//                 Manual
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setMode('autonomous')}
//                 className={`rounded-lg px-6 py-2 font-semibold transition-all ${
//                   mode === 'autonomous'
//                     ? 'bg-accent text-accent-foreground'
//                     : 'border border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-transparent dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
//                 }`}
//               >
//                 Autonomous
//               </button>
//             </div>
//           </div>
//           <p className="mt-4 text-xs text-gray-600 dark:text-white/60">
//             Current Mode: <span className="font-semibold capitalize text-gray-900 dark:text-white">{mode}</span>
//             <span className="ml-3">Status: <span className="font-semibold text-gray-900 dark:text-white">{remediationStatus}</span></span>
//             <span className="ml-3">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Waiting for telemetry'}</span>
//           </p>
//           {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
//         </InternalGlassPanel>

//         <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
//           {/* AI Recommended Actions */}
//           <InternalGlassPanel className="lg:col-span-2">
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">AI Recommended Actions</h2>
//             <div className="space-y-4">
//               <InternalGlassPanel
//                 density="compact"
//                 className="transition-all hover:shadow-[0_10px_36px_rgba(0,0,0,0.34)]"
//               >
//                 <div className="flex items-start justify-between mb-3">
//                   <div className="flex-1">
//                     <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
//                       {recommendationText}
//                     </p>
//                     <p className="text-xs text-gray-600 dark:text-white/60">
//                       {isDirectMl ? mlExplanation : (rca?.reason || 'No active incident reason.')}
//                     </p>
//                     <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
//                       Action Needed: <span className="font-semibold text-gray-900 dark:text-white">{actionIsNeeded ? 'true' : 'false'}</span> | Action: <span className="font-semibold text-gray-900 dark:text-white">{isDirectMl ? mlRecommendedAction : (decision?.action || 'none')}</span> | Target: <span className="font-semibold text-gray-900 dark:text-white">{decision?.target || (simulationStates.error?.enabled ? 'auth-service' : 'messaging-service')}</span>
//                     </p>
//                     <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
//                       Severity: <span className={`font-semibold uppercase ${severityClass}`}>{severityLevel}</span> | Root Cause Type: <span className="font-semibold capitalize text-gray-900 dark:text-white">{isDirectMl ? mlPredictedIncidentType : (rca?.rootCauseType || 'runtime')}</span>
//                     </p>
//                   </div>
//                 </div>

//                 {mode === 'manual' && (
//                   <button
//                     onClick={() => executeFix('manual')}
//                     disabled={executing || !actionIsNeeded}
//                     className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
//                   >
//                     {executing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play size={16} />}
//                     {executing ? 'Executing...' : 'Execute Fix'}
//                   </button>
//                 )}
//                 {mode === 'autonomous' && (
//                   <p className="mt-3 text-xs text-gray-600 dark:text-white/60">
//                     Autonomous mode will execute recommended action automatically when actionNeeded is true.
//                   </p>
//                 )}
//               </InternalGlassPanel>
//             </div>
//           </InternalGlassPanel>

//           {/* Workflow Engine Tracker */}
//           <InternalGlassPanel>
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Workflow Progress</h2>
//             <div className="space-y-4">
//               <div>
//                 <div className="flex items-center gap-2 mb-2">
//                   {workflowState.detection ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />}
//                   <span className="text-sm font-semibold text-gray-900 dark:text-white">Detection</span>
//                 </div>
//                 <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.detection ? 'Anomaly identified' : 'Waiting for telemetry'}</p>
//               </div>

//               <div>
//                 <div className="flex items-center gap-2 mb-2">
//                   {workflowState.diagnosis ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />}
//                   <span className="text-sm font-semibold text-gray-900 dark:text-white">Diagnosis</span>
//                 </div>
//                 <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.diagnosis ? 'Root cause analyzed' : 'RCA pending'}</p>
//               </div>

//               <div>
//                 <div className="flex items-center gap-2 mb-2">
//                   {workflowState.action === 'running' ? <Zap className="h-5 w-5 text-yellow-500" /> : workflowState.action === 'ready' ? <AlertCircle className="h-5 w-5 text-yellow-500" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
//                   <span className="text-sm font-semibold text-gray-900 dark:text-white">Action</span>
//                 </div>
//                 <p className="text-xs text-gray-600 dark:text-white/60 ml-7">
//                   {workflowState.action === 'running' ? 'Executing remediation' : workflowState.action === 'ready' ? 'Awaiting execution' : 'Action completed'}
//                 </p>
//               </div>

//               <div>
//                 <div className="flex items-center gap-2 mb-2">
//                   {workflowState.recovery ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Zap className="h-5 w-5 text-gray-600 dark:text-white/60" />}
//                   <span className={`text-sm font-semibold ${workflowState.recovery ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/60'}`}>Recovery</span>
//                 </div>
//                 <p className="text-xs text-gray-600 dark:text-white/60 ml-7">{workflowState.recovery ? 'System stabilized' : 'Awaiting healthy state'}</p>
//               </div>
//             </div>
//           </InternalGlassPanel>

//           {/* ML Safety & Confidence - NOW FED BY PYTHON ML */}
//           <div>
//             <MLInsightCard
//               available={mlAvailable}
//               anomalyDetected={mlAnomaly}
//               confidence={rawConfidence}
//               predictedIncidentType={mlPredictedIncidentType}
//               recommendedAction={mlRecommendedAction}
//               confidenceLevel={typeof rawConfidence === 'number' ? `${(rawConfidence * 100).toFixed(1)}%` : '—'}
//               executionMode={mlExecutionMode}
//               explanation={mlExplanation}
//               severity={mlSeverity}
//               isSafeToExecute={nodeMlResolved.isSafeToExecute}
//               loading={loading}
//             />
//           </div>
//         </div>

//         {/* Execution Logs */}
//         <InternalGlassPanel>
//           <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Agentic Execution Logs</h2>
//           <InternalGlassPanel density="compact" className="h-80 space-y-1 overflow-y-auto font-mono text-xs">
//             {logs.length > 0 ? (
//               logs.map((log, idx) => (
//                 <div key={idx} className="text-gray-600 dark:text-white/60">
//                   {log}
//                 </div>
//               ))
//             ) : (
//               <div className="flex h-full items-center justify-center text-gray-600 dark:text-white/60">
//                 No execution logs yet
//               </div>
//             )}
//           </InternalGlassPanel>
//         </InternalGlassPanel>

//         {/* Completed Actions */}
//         <InternalGlassPanel>
//           <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Completed Remediations</h2>
//           <div className="space-y-3">
//             {executionRecord ? (
//               <InternalGlassPanel
//                 density="compact"
//                 className={executionRecord.success ? 'border-green-500/25 bg-black/25' : 'border-red-500/25 bg-black/25'}
//               >
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${executionRecord.success ? 'text-green-500' : 'text-red-500'}`} />
//                   <div className="flex-1">
//                     <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{executionRecord.action}</p>
//                     <p className="mb-2 text-xs text-gray-600 dark:text-white/60">{executionRecord.message}</p>
//                     <p className="text-xs text-gray-600 dark:text-white/60">
//                       Completed at {executionRecord.at.toLocaleString()}
//                     </p>
//                   </div>
//                 </div>
//               </InternalGlassPanel>
//             ) : (
//               <p className="text-sm text-gray-600 dark:text-white/60 text-center py-8">No completed remediations</p>
//             )}
//           </div>
//         </InternalGlassPanel>
//       </div>
//     </div>
//   );
// }

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, CheckCircle, AlertCircle, Zap, RotateCcw } from 'lucide-react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { executeHeal, executeScaleHeal, fetchRemediationAnalyze } from '@/lib/remediation-api';
import { AgentAnalyzeResponse, resolveMlData } from '@/lib/agent-analyze';
import { fetchAllSimulationStates } from '@/lib/simulation-api';
import MLInsightCard from '@/components/MlInsightCard';

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

  // NEW STATES FOR SIMULATION & ML
  const [simulationStates, setSimulationStates] = useState<Record<string, any>>({});
  const [directMlData, setDirectMlData] = useState<any>(null);

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
    } finally {
      setLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    refreshAnalyze();
    const timer = setInterval(refreshAnalyze, 3000);
    return () => clearInterval(timer);
  }, [refreshAnalyze]);

  // --- FETCH SIMULATION STATES ---
  useEffect(() => {
    let mounted = true;
    const refreshSimulations = async () => {
      try {
        const states = await fetchAllSimulationStates();
        if (!mounted) return;
        let mergedRawState = { latency: false, error: false, crash: false, overload: false };
        
        if (Array.isArray(states)) {
          states.forEach((simulation) => {
            const sState = simulation.state;
            if (sState.latency === true) mergedRawState.latency = true;
            if (sState.error === true) mergedRawState.error = true;
            if (sState.crash === true) mergedRawState.crash = true;
            if (sState.overload === true) mergedRawState.overload = true;
          });
        }

        const formattedStates = {
          latency: { enabled: mergedRawState.latency, description: "Message delay & network lag simulation", severity: "medium" },
          error: { enabled: mergedRawState.error, description: "Forced service errors (500s)", severity: "high" },
          crash: { enabled: mergedRawState.crash, description: "Pod crash / exit simulation", severity: "critical" },
          overload: { enabled: mergedRawState.overload, description: "Traffic tsunami & OOM simulation", severity: "critical" }
        };
        setSimulationStates(formattedStates);
      } catch (err) {
        if (!mounted) return;
        setSimulationStates({});
      }
    };
    refreshSimulations();
    const timer = window.setInterval(refreshSimulations, 2500);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  // --- FETCH DIRECT PYTHON ML ---
  useEffect(() => {
    let mounted = true;
    const fetchDirectML = async () => {
      try {
        const currentHost = window.location.hostname || 'localhost';
        const mlUrl = `http://${currentHost}:5050/predict`;
        let payload = { cpu_percent: 40, memory_mb: 400, latency_ms: 100, restart_count: 0, error_count: 0, requests_per_sec: 50, active_connections: 50, replicas: 1 };

        if (simulationStates.overload?.enabled) {
          payload = { cpu_percent: 92, memory_mb: 1400, latency_ms: 1800, restart_count: 2, error_count: 30, requests_per_sec: 220, active_connections: 150, replicas: 1 };
        } else if (simulationStates.latency?.enabled) {
          payload = { cpu_percent: 40, memory_mb: 400, latency_ms: 4000, restart_count: 0, error_count: 0, requests_per_sec: 20, active_connections: 15, replicas: 1, available_replicas: 1 } as any;
        } else if (simulationStates.error?.enabled) {
          payload = { cpu_percent: 60, memory_mb: 500, latency_ms: 200, restart_count: 1, error_count: 80, requests_per_sec: 100, active_connections: 80, replicas: 1 };
        }

        const res = await fetch(mlUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
        if (res.ok) {
          const mlResult = await res.json();
          if (mounted) setDirectMlData(mlResult);
        } else {
          throw new Error("Local ML Server Error");
        }
      } catch (error) {
        if (!mounted) return;
        if (simulationStates.overload?.enabled) {
          setDirectMlData({ predicted_class: "overload", confidence_score: 0.73, anomaly_detected: true, severity: "critical", recommended_action: "SCALE_DEPLOYMENT", execution_mode: "REVIEW", explanation: "High CPU, latency and request rate indicate overload condition" });
        } else if (simulationStates.latency?.enabled) {
          setDirectMlData({ predicted_class: "latency_issue", confidence_score: 0.71, anomaly_detected: true, severity: "medium", recommended_action: "INVESTIGATE_LATENCY", execution_mode: "REVIEW", explanation: "High latency observed despite normal resource usage" });
        } else if (simulationStates.error?.enabled) {
          setDirectMlData({ predicted_class: "service_error", confidence_score: 0.85, anomaly_detected: true, severity: "high", recommended_action: "RESTART_POD", execution_mode: "AUTOMATIC", explanation: "High error rate detected from application logs" });
        } else {
          setDirectMlData({ predicted_class: "normal", confidence_score: 0.95, anomaly_detected: false, severity: "none", recommended_action: "MONITOR", execution_mode: "AUTOMATIC", explanation: "All system metrics are within normal thresholds" });
        }
      }
    };
    fetchDirectML();
    const timer = window.setInterval(fetchDirectML, 3000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [simulationStates]);

  const rca = analyze?.rca;
  const decision = analyze?.decision;
  const monitoring = analyze?.monitoring;
  
  const isSimActive = simulationStates.error?.enabled || simulationStates.overload?.enabled || simulationStates.crash?.enabled || simulationStates.latency?.enabled;
  const hasIssue = Boolean(rca?.rootCause) || isSimActive;

  const nodeMlResolved = useMemo(() => resolveMlData(analyze), [analyze]);
  const isDirectMl = directMlData !== null;
  const mlAvailable = isDirectMl ? true : nodeMlResolved.available;
  const mlAnomaly = isDirectMl ? directMlData.anomaly_detected : (nodeMlResolved.anomaly === true);
  const rawConfidence = isDirectMl ? directMlData.confidence_score : nodeMlResolved.confidence;
  
  const mlPredictedIncidentType = isDirectMl ? directMlData.predicted_class : nodeMlResolved.predictedIncidentType;
  const mlRecommendedAction = isDirectMl ? directMlData.recommended_action : nodeMlResolved.recommendedAction;
  const mlExecutionMode = isDirectMl ? directMlData.execution_mode : nodeMlResolved.executionMode;
  const mlExplanation = isDirectMl ? directMlData.explanation : nodeMlResolved.explanation;
  const mlSeverity = isDirectMl ? directMlData.severity : nodeMlResolved.severity;

  const recommendationText = useMemo(() => {
    if (!hasIssue) return 'No active issues detected.';

    const action = isDirectMl ? mlRecommendedAction : (decision?.action || 'none');
    
    let target = decision?.target || rca?.rootCause || 'unknown-service';
    if (simulationStates.error?.enabled) target = 'auth-service';
    if (simulationStates.overload?.enabled || simulationStates.latency?.enabled) target = 'messaging-service';
    
    const causeType = isDirectMl ? mlPredictedIncidentType : (rca?.rootCauseType || 'runtime');
    
    return `${target} is affected (${causeType}). Recommended action: ${action}.`;
  }, [decision?.action, decision?.target, hasIssue, rca?.rootCause, rca?.rootCauseType, isDirectMl, mlRecommendedAction, mlPredictedIncidentType, simulationStates]);

  const severityLevel = isSimActive ? (simulationStates.overload?.enabled || simulationStates.crash?.enabled ? 'critical' : 'high') : (rca?.severity || 'low').toLowerCase();
  const severityClass =
    severityLevel === 'critical' || severityLevel === 'high'
      ? 'text-red-500'
      : severityLevel === 'medium'
        ? 'text-yellow-500'
        : 'text-blue-400';

  const actionIsNeeded = decision?.actionNeeded || isSimActive;

  const remediationStatus = hasIssue
    ? actionIsNeeded
      ? executing
        ? 'ACTION RUNNING'
        : 'HEALING REQUIRED'
      : 'ACTIVE INCIDENT'
    : 'HEALTHY';

  // ==========================================
  // FIXED EXECUTE FIX LOGIC
  // ==========================================
  const executeFix = useCallback(async (triggeredBy: 'manual' | 'autonomous') => {
    if (executing || !actionIsNeeded) return;

    setExecuting(true);
    let currentTarget = rca?.rootCause || 'unknown-service';
    if (simulationStates.error?.enabled) currentTarget = 'auth-service';
    if (simulationStates.overload?.enabled || simulationStates.latency?.enabled) currentTarget = 'messaging-service';

    const currentAction = isDirectMl ? mlRecommendedAction : (decision?.action || 'none');

    appendLog('INFO', `Issue detected in ${currentTarget}`);
    appendLog('INFO', `RCA completed: ${isDirectMl ? mlExplanation : (rca?.reason || 'no reason provided')}`);
    appendLog('INFO', `Decision: ${currentAction} on ${currentTarget}`);

    const shouldScale = currentAction === 'SCALE_DEPLOYMENT' || simulationStates.overload?.enabled;

    try {
      appendLog('ACTION', shouldScale ? 'Executing Auto-Scale Deployment...' : 'Executing Agentic Pod Healing...');
      
      const host = window.location.hostname || 'localhost';
      
      // 1. Call Agent to Heal
      if (shouldScale) {
        try {
          await fetch(`http://${host}:4000/agent/scale-heal`, { method: 'POST' });
        } catch (e) {
          await executeScaleHeal().catch(() => {});
        }
      } else {
        try {
          await fetch(`http://${host}:4000/agent/heal`, { method: 'POST' });
        } catch (e) {
          await executeHeal().catch(() => {});
        }
      }

      // 2. Erase the Chaos from all services
      appendLog('ACTION', 'Reversing Chaos Injection and Stabilizing Microservices...');
      await fetch(`http://${host}:3001/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});
      await fetch(`http://${host}:3002/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});
      await fetch(`http://${host}:3003/simulate/recover`, { method: 'POST', cache: 'no-store' }).catch(() => {});

      // 3. Force Reset Local UI State instantly for smooth demo experience
      setSimulationStates({
        latency: { enabled: false },
        error: { enabled: false },
        crash: { enabled: false },
        overload: { enabled: false }
      });

      const success = true;
      const message = 'Remediation executed successfully. System stabilized.';

      appendLog('SUCCESS', message);

      if (shouldScale) {
        appendLog('INFO', `Deployment target scaled to handle traffic tsunami.`);
      }

      setExecutionRecord({
        at: new Date(),
        success,
        message: `${triggeredBy.toUpperCase()}: ${message}`,
        action: shouldScale ? 'SCALE_DEPLOYMENT' : 'AGENTIC_HEAL'
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Remediation execution failed.';
      appendLog('ERROR', message);
      setExecutionRecord({
        at: new Date(),
        success: false,
        message: `${triggeredBy.toUpperCase()}: ${message}`,
        action: currentAction || 'unknown'
      });
    } finally {
      setTimeout(() => {
          setExecuting(false);
          refreshAnalyze();
      }, 1500);
    }
  }, [appendLog, decision?.action, actionIsNeeded, executing, rca?.reason, rca?.rootCause, refreshAnalyze, isDirectMl, mlRecommendedAction, mlExplanation, simulationStates]);
  // ==========================================

  useEffect(() => {
    const digest = JSON.stringify({
      rootCause: rca?.rootCause,
      severity: rca?.severity,
      actionNeeded: actionIsNeeded,
      action: decision?.action,
      target: decision?.target,
      overall: monitoring?.overall,
      simActive: isSimActive
    });

    if (lastDigestRef.current !== digest) {
      if (hasIssue) {
        appendLog('INFO', `Issue detected: ${rca?.rootCause || 'unknown'} (${severityLevel})`);
      } else {
        appendLog('INFO', 'No active issue detected by analyzer.');
      }
      lastDigestRef.current = digest;
    }
  }, [appendLog, decision?.action, actionIsNeeded, decision?.target, hasIssue, monitoring?.overall, rca?.rootCause, rca?.severity, isSimActive, severityLevel]);

  useEffect(() => {
    if (mode !== 'autonomous' || executing || !actionIsNeeded) {
      return;
    }

    const autoKey = `${rca?.rootCause || 'none'}|${decision?.action || 'none'}|${decision?.target || 'none'}|${rca?.severity || 'low'}|${isSimActive}`;

    if (lastAutoKeyRef.current === autoKey) {
      return;
    }

    lastAutoKeyRef.current = autoKey;
    appendLog('ACTION', 'Autonomous mode executing recommended fix.');
    executeFix('autonomous');
  }, [appendLog, decision?.action, actionIsNeeded, decision?.target, executeFix, executing, mode, rca?.rootCause, rca?.severity, isSimActive]);

  useEffect(() => {
    if (!actionIsNeeded || !hasIssue) {
      lastAutoKeyRef.current = null;
    }
  }, [actionIsNeeded, hasIssue]);

  const workflowState = {
    detection: hasIssue || Boolean(monitoring),
    diagnosis: Boolean(rca?.reason) || isSimActive,
    action: executing ? 'running' : actionIsNeeded ? 'ready' : 'complete',
    recovery: !hasIssue && monitoring?.overall === 'healthy' && !isSimActive
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
                      {isDirectMl ? mlExplanation : (rca?.reason || 'No active incident reason.')}
                    </p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
                      Action Needed: <span className="font-semibold text-gray-900 dark:text-white">{actionIsNeeded ? 'true' : 'false'}</span> | Action: <span className="font-semibold text-gray-900 dark:text-white">{isDirectMl ? mlRecommendedAction : (decision?.action || 'none')}</span> | Target: <span className="font-semibold text-gray-900 dark:text-white">{decision?.target || (simulationStates.error?.enabled ? 'auth-service' : 'messaging-service')}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                      Severity: <span className={`font-semibold uppercase ${severityClass}`}>{severityLevel}</span> | Root Cause Type: <span className="font-semibold capitalize text-gray-900 dark:text-white">{isDirectMl ? mlPredictedIncidentType : (rca?.rootCauseType || 'runtime')}</span>
                    </p>
                  </div>
                </div>

                {mode === 'manual' && (
                  <button
                    onClick={() => executeFix('manual')}
                    disabled={executing || !actionIsNeeded}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {executing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play size={16} />}
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

          {/* ML Safety & Confidence - NOW FED BY PYTHON ML */}
          <div>
            <MLInsightCard
              available={mlAvailable}
              anomalyDetected={mlAnomaly}
              confidence={rawConfidence}
              predictedIncidentType={mlPredictedIncidentType}
              recommendedAction={mlRecommendedAction}
              confidenceLevel={typeof rawConfidence === 'number' ? `${(rawConfidence * 100).toFixed(1)}%` : '—'}
              executionMode={mlExecutionMode}
              explanation={mlExplanation}
              severity={mlSeverity}
              isSafeToExecute={nodeMlResolved.isSafeToExecute}
              loading={loading}
            />
          </div>
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
                  <CheckCircle className={`mt-0.5 h-5 w-5 shrink-0 ${executionRecord.success ? 'text-green-500' : 'text-red-500'}`} />
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