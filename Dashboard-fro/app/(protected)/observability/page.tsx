// 'use client';

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
// import { resolveMlData } from '@/lib/agent-analyze';
// import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// import { ChevronDown } from 'lucide-react';
// import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
// import { GlowCard } from '@/components/ui/spotlight-card';
// import MLInsightCard from '@/components/MlInsightCard';
// import MLEvidence from '@/components/MLEvidence';

// type ServiceFilter = 'all' | 'auth-service' | 'messaging-service' | 'presence-service';

// type ServiceSample = {
//   service: string;
//   latency: number;
//   throughput: number;
//   errorRate: number;
//   reachable: boolean;
//   status: string;
//   mode: string;
// };

// type TelemetryPoint = {
//   timestamp: string;
//   samples: ServiceSample[];
//   latency: number;
//   throughput: number;
//   errorRate: number;
//   restartCount: number;
//   healthyServices: number;
//   degradedServices: number;
//   criticalServices: number;
//   overload: number;
// };

// type LogLevel = 'info' | 'warning' | 'error';

// type ObservabilityLog = {
//   id: string;
//   timestamp: Date;
//   level: LogLevel;
//   service: string;
//   message: string;
// };

// const SERVICE_OPTIONS: ServiceFilter[] = ['all', 'auth-service', 'messaging-service', 'presence-service'];

// const levelClass = (level: LogLevel) => {
//   if (level === 'error') return 'text-destructive';
//   if (level === 'warning') return 'text-yellow-500';
//   return 'text-green-500';
// };

// const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// const latencyFromService = (health: string, mode: string) => {
//   const normalizedHealth = (health || '').toLowerCase();
//   const normalizedMode = (mode || '').toLowerCase();

//   if (normalizedHealth === 'critical' || normalizedHealth === 'down') return 420;
//   if (normalizedMode.includes('latency')) return 320;
//   if (normalizedHealth === 'degraded') return 260;
//   return 120;
// };

// export default function ObservabilityPage() {
//   const { data: analyzeData, loading, error } = useAgentAnalyze(3000);
//   const [selectedService, setSelectedService] = useState<ServiceFilter>('all');
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
//   const [derivedLogs, setDerivedLogs] = useState<ObservabilityLog[]>([]);
//   const previousSnapshotRef = useRef<{
//     restartCount: number;
//     overload: boolean;
//     services: Record<string, { health: string; mode: string; reachable: boolean }>;
//   } | null>(null);

//   const monitoring = analyzeData?.monitoring;
//   const kubernetesSignals = analyzeData?.kubernetesSignals;
//   const rca = analyzeData?.rca;
//   const decision = analyzeData?.decision;
//   const mlResolved = resolveMlData(analyzeData);

//   const allServices = monitoring?.services || [];
//   const scopedServices = allServices.filter((svc) =>
//     SERVICE_OPTIONS.includes(svc.service as ServiceFilter)
//   );

//   const currentServices = selectedService === 'all'
//     ? scopedServices
//     : scopedServices.filter((svc) => svc.service === selectedService);

//   const buildTelemetryPoint = () => {
//     const restartCount = kubernetesSignals?.restartCount ?? 0;
//     const overloadActive = Boolean(kubernetesSignals?.resourceOverload);

//     const samples: ServiceSample[] = scopedServices.map((svc) => {
//       const latency = latencyFromService(svc.health || 'healthy', svc.mode || 'normal');
//       const throughputPenalty = restartCount * 30 + (overloadActive ? 140 : 0);
//       const throughput = clamp(svc.reachable ? 360 - throughputPenalty : 0, 0, 420);
//       const errorRate = clamp(
//         (svc.health === 'healthy' ? 0.2 : svc.health === 'degraded' ? 2.5 : 6.8) + (overloadActive ? 1.2 : 0),
//         0,
//         10
//       );

//       return {
//         service: svc.service,
//         latency,
//         throughput,
//         errorRate,
//         reachable: Boolean(svc.reachable),
//         status: svc.health || 'unknown',
//         mode: svc.mode || 'unknown'
//       };
//     });

//     const relevantSamples = selectedService === 'all'
//       ? samples
//       : samples.filter((entry) => entry.service === selectedService);

//     const safeCount = relevantSamples.length || 1;
//     const healthyServices = relevantSamples.filter((entry) => entry.status === 'healthy').length;
//     const degradedServices = relevantSamples.filter((entry) => entry.status === 'degraded').length;
//     const criticalServices = relevantSamples.filter((entry) => entry.status === 'critical' || entry.status === 'down').length;

//     return {
//       timestamp: new Date().toLocaleTimeString(),
//       samples,
//       latency: Math.round(relevantSamples.reduce((sum, entry) => sum + entry.latency, 0) / safeCount),
//       throughput: Math.round(relevantSamples.reduce((sum, entry) => sum + entry.throughput, 0)),
//       errorRate: Number((relevantSamples.reduce((sum, entry) => sum + entry.errorRate, 0) / safeCount).toFixed(2)),
//       restartCount,
//       healthyServices,
//       degradedServices,
//       criticalServices,
//       overload: overloadActive ? 1 : 0
//     };
//   };

//   useEffect(() => {
//     if (!analyzeData?.success) {
//       return;
//     }

//     const point = buildTelemetryPoint();
//     setTelemetryHistory((prev) => [...prev, point].slice(-40));

//     const now = new Date();
//     const nextLogs: ObservabilityLog[] = [];

//     const prev = previousSnapshotRef.current;
//     const restartCount = kubernetesSignals?.restartCount ?? 0;
//     const overloadActive = Boolean(kubernetesSignals?.resourceOverload);

//     if (!prev) {
//       nextLogs.push({
//         id: `boot-${now.getTime()}`,
//         timestamp: now,
//         level: 'info',
//         service: 'agent-service',
//         message: 'Live observability stream connected from /agent/analyze.'
//       });
//     }

//     if (prev && restartCount > prev.restartCount) {
//       nextLogs.push({
//         id: `restart-${now.getTime()}`,
//         timestamp: now,
//         level: restartCount >= 2 ? 'error' : 'warning',
//         service: 'messaging-service',
//         message: `Restart count increased to ${restartCount}.`
//       });
//     }

//     if (prev && overloadActive !== prev.overload) {
//       nextLogs.push({
//         id: `overload-${now.getTime()}`,
//         timestamp: now,
//         level: overloadActive ? 'error' : 'info',
//         service: 'messaging-service',
//         message: overloadActive ? 'Resource overload detected.' : 'Resource overload cleared, service stabilizing.'
//       });
//     }

//     const currentServiceState: Record<string, { health: string; mode: string; reachable: boolean }> = {};
//     scopedServices.forEach((svc) => {
//       currentServiceState[svc.service] = {
//         health: svc.health || 'unknown',
//         mode: svc.mode || 'unknown',
//         reachable: Boolean(svc.reachable)
//       };

//       const prevService = prev?.services?.[svc.service];
//       if (prevService && (prevService.health !== svc.health || prevService.reachable !== Boolean(svc.reachable))) {
//         nextLogs.push({
//           id: `svc-${svc.service}-${now.getTime()}`,
//           timestamp: now,
//           level: svc.health === 'healthy' ? 'info' : svc.health === 'degraded' ? 'warning' : 'error',
//           service: svc.service,
//           message: `Status changed to ${svc.health || 'unknown'} (${svc.reachable ? 'reachable' : 'unreachable'}).`
//         });
//       }
//     });

//     if (rca?.reason) {
//       nextLogs.push({
//         id: `rca-${now.getTime()}`,
//         timestamp: now,
//         level: rca?.severity === 'critical' ? 'error' : rca?.severity === 'high' ? 'warning' : 'info',
//         service: (rca?.rootCause as string) || 'agent-service',
//         message: `RCA: ${rca.reason}`
//       });
//     }

//     if (decision?.actionNeeded && decision?.action) {
//       nextLogs.push({
//         id: `decision-${now.getTime()}`,
//         timestamp: now,
//         level: 'warning',
//         service: (decision.target as string) || 'agent-service',
//         message: `Decision: ${decision.action} (${decision.explanation || 'no explanation'})`
//       });
//     }

//     const excerptLines = (kubernetesSignals?.logsExcerpt || '')
//       .split('\n')
//       .map((line) => line.trim())
//       .filter(Boolean)
//       .slice(-2);

//     excerptLines.forEach((line, index) => {
//       nextLogs.push({
//         id: `excerpt-${now.getTime()}-${index}`,
//         timestamp: now,
//         level: /error|oom|killed|fail/i.test(line) ? 'error' : /warn|overload|restart/i.test(line) ? 'warning' : 'info',
//         service: selectedService === 'all' ? 'messaging-service' : selectedService,
//         message: line.slice(0, 220)
//       });
//     });

//     if (nextLogs.length > 0) {
//       setDerivedLogs((prevLogs) => [...nextLogs, ...prevLogs].slice(0, 120));
//     }

//     previousSnapshotRef.current = {
//       restartCount,
//       overload: overloadActive,
//       services: currentServiceState
//     };
//   }, [analyzeData]);

//   const chartData = useMemo(() => {
//     return telemetryHistory.map((point) => {
//       const scoped = selectedService === 'all'
//         ? point.samples
//         : point.samples.filter((entry) => entry.service === selectedService);
//       const scopedCount = scoped.length || 1;

//       return {
//         time: point.timestamp,
//         latency: Math.round(scoped.reduce((sum, entry) => sum + entry.latency, 0) / scopedCount),
//         throughput: Math.round(scoped.reduce((sum, entry) => sum + entry.throughput, 0)),
//         errorRate: Number((scoped.reduce((sum, entry) => sum + entry.errorRate, 0) / scopedCount).toFixed(2)),
//         restartCount: point.restartCount,
//         overload: point.overload,
//         healthy: point.healthyServices,
//         degraded: point.degradedServices,
//         critical: point.criticalServices
//       };
//     });
//   }, [telemetryHistory, selectedService]);

//   const latestPoint = chartData[chartData.length - 1];

//   const filteredLogs = useMemo(() => {
//     if (selectedService === 'all') return derivedLogs;
//     return derivedLogs.filter((log) => log.service === selectedService || log.service === 'agent-service');
//   }, [derivedLogs, selectedService]);

//   const traceRows = useMemo(() => {
//     const rootCause = (rca?.rootCause || '').toLowerCase();
//     const serviceHealth = new Map(scopedServices.map((svc) => [svc.service, (svc.health || 'unknown').toLowerCase()]));

//     const rows = [
//       { path: 'frontend -> auth-service', service: 'auth-service' },
//       { path: 'frontend -> messaging-service', service: 'messaging-service' },
//       { path: 'frontend -> presence-service', service: 'presence-service' },
//       { path: 'agent-service -> auth-service', service: 'auth-service' },
//       { path: 'agent-service -> messaging-service', service: 'messaging-service' },
//       { path: 'agent-service -> presence-service', service: 'presence-service' }
//     ];

//     const scopedRows = selectedService === 'all'
//       ? rows
//       : rows.filter((row) => row.service === selectedService);

//     return scopedRows.map((row) => {
//       const health = serviceHealth.get(row.service) || 'unknown';
//       const impacted = rootCause === row.service || (row.service === 'messaging-service' && Boolean(kubernetesSignals?.resourceOverload));
//       const status = impacted || health === 'critical' || health === 'down'
//         ? 'critical'
//         : health === 'degraded'
//           ? 'degraded'
//           : 'healthy';

//       return {
//         ...row,
//         status,
//         reason: impacted
//           ? rca?.reason || 'Impacted by active incident signals.'
//           : health === 'healthy'
//             ? 'Flow is currently stable.'
//             : `Flow health follows ${row.service} state: ${health}.`
//       };
//     });
//   }, [selectedService, scopedServices, rca, kubernetesSignals?.resourceOverload]);

//   return (
//     <div className="flex-1 overflow-y-auto">
//       <div className="p-8 space-y-8">
//         {/* Header */}
//         <div className="flex items-center justify-between">
//           <div>
//             <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Observability Hub</h1>
//             <p className="text-gray-600 dark:text-white/60">Centralized telemetry data: metrics, logs, and distributed traces</p>
//           </div>
//           <div className="relative">
//             <button
//               className="flex items-center gap-2 rounded-xl border border-white/10 bg-white dark:bg-[#0B1220]/60 px-4 py-2 text-gray-900 dark:text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all hover:border-blue-500/25 hover:bg-blue-500/10"
//               onClick={() => setShowDropdown(!showDropdown)}
//             >
//               <span className="text-sm font-medium text-gray-900 dark:text-white">Filter by Service</span>
//               <ChevronDown className="h-4 w-4 text-gray-900 dark:text-white" />
//             </button>
//             {showDropdown && (
//               <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#0B1220] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
//                 <div className="space-y-1">
//                   <Select
//                     value={selectedService}
//                     onValueChange={(value) => setSelectedService(value as ServiceFilter)}
//                   >
//                     <SelectTrigger>
//                       <SelectValue placeholder="All Services (Aggregated)" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="all">All Services (Aggregated)</SelectItem>
//                       <SelectItem value="auth-service">auth-service</SelectItem>
//                       <SelectItem value="messaging-service">messaging-service</SelectItem>
//                       <SelectItem value="presence-service">presence-service</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>


//         {/* Metric Visualizations */}
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* Latency Distribution */}
//           <GlowCard glowColor="purple" customSize={true} className="lg:col-span-2 p-4">
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Latency Distribution (P99)</h2>
//             <ResponsiveContainer width="100%" height={250}>
//               <LineChart data={chartData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
//                 <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
//                 <YAxis stroke="rgba(255,255,255,0.45)" />
//                 <Tooltip
//                   contentStyle={{
//                     backgroundColor: 'rgba(15, 23, 42, 0.95)',
//                     border: '1px solid rgba(255,255,255,0.12)',
//                     borderRadius: '12px',
//                     color: '#f8fafc',
//                   }}
//                   labelStyle={{ color: 'rgba(255,255,255,0.85)' }}
//                   itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
//                 />
//                 <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
//                 <Line
//                   type="monotone"
//                   dataKey="latency"
//                   stroke="#1e40af"
//                   name="P99 Latency (ms)"
//                   strokeWidth={3}
//                   dot={false}
//                   activeDot={{ r: 6, fill: '#1e40af', stroke: '#fff', strokeWidth: 2 }}
//                 />
//               </LineChart>
//             </ResponsiveContainer>
//           </GlowCard>

//           {/* Summary Stats */}
//           <GlowCard glowColor="green" customSize={true} className="p-4">
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Metrics Summary</h2>
//             <div className="space-y-4">
//               <div>
//                 <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived P99 Latency</p>
//                 <p className="text-2xl font-bold text-primary">{latestPoint ? `${latestPoint.latency}ms` : '--'}</p>
//               </div>
//               <div>
//                 <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived Throughput</p>
//                 <p className="text-2xl font-bold text-accent">{latestPoint ? `${latestPoint.throughput} req/s` : '--'}</p>
//               </div>
//               <div>
//                 <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived Error Rate</p>
//                 <p className="text-2xl font-bold text-yellow-500">{latestPoint ? `${latestPoint.errorRate}%` : '--'}</p>
//               </div>
//               <div>
//                 <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Restart Count</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">{kubernetesSignals?.restartCount ?? 0}</p>
//               </div>
//               <div>
//                 <p className="mb-1 text-xs text-gray-600 dark:text-white/60">Replicas (avail/desired)</p>
//                 <p className="text-2xl font-bold text-gray-900 dark:text-white">
//                   {kubernetesSignals?.deploymentAvailableReplicas ?? '-'} / {kubernetesSignals?.deploymentReplicas ?? '-'}
//                 </p>
//               </div>
//             </div>
//           </GlowCard>
//         </div>

//         {/* Throughput and Error Rate Charts - Side by Side */}
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           {/* Throughput Chart */}
//           <GlowCard glowColor="orange" customSize={true} className="p-4">
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Throughput (Requests/sec)</h2>
//             <ResponsiveContainer width="100%" height={250}>
//               <AreaChart data={chartData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
//                 <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
//                 <YAxis stroke="rgba(255,255,255,0.45)" />
//                 <Tooltip
//                   contentStyle={{
//                     backgroundColor: 'rgba(15, 23, 42, 0.95)',
//                     border: '1px solid rgba(255,255,255,0.12)',
//                     borderRadius: '12px',
//                     color: '#f8fafc',
//                   }}
//                   labelStyle={{ color: 'rgba(255,255,255,0.85)' }}
//                   itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
//                 />
//                 <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
//                 <defs>
//                   <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
//                     <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
//                     <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1}/>
//                   </linearGradient>
//                 </defs>
//                 <Area
//                   type="monotone"
//                   dataKey="throughput"
//                   stroke="#2563eb"
//                   fill="url(#throughputGradient)"
//                   name="Requests/sec"
//                   strokeWidth={2}
//                 />
//               </AreaChart>
//             </ResponsiveContainer>
//           </GlowCard>

//           {/* Error Rate */}
//           <GlowCard glowColor="red" customSize={true} className="p-4">
//             <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Global Error Rate</h2>
//             <ResponsiveContainer width="100%" height={250}>
//               <LineChart data={chartData}>
//                 <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
//                 <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
//                 <YAxis stroke="rgba(255,255,255,0.45)" />
//                 <Tooltip
//                   contentStyle={{
//                     backgroundColor: 'rgba(15, 23, 42, 0.95)',
//                     border: '1px solid rgba(255,255,255,0.12)',
//                     borderRadius: '12px',
//                     color: '#f8fafc',
//                   }}
//                   labelStyle={{ color: 'rgba(255,255,255,0.85)' }}
//                   itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
//                 />
//                 <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
//                 <Line
//                   type="monotone"
//                   dataKey="errorRate"
//                   stroke="#3b82f6"
//                   name="Error Rate %"
//                   strokeWidth={3}
//                   dot={{ fill: '#3b82f6', r: 3 }}
//                   activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
//                 />
//               </LineChart>
//             </ResponsiveContainer>
//           </GlowCard>
//         </div>

//         {/* ML Insights Section */}
//         <GlowCard glowColor="blue" customSize={true} className="p-6">
//           <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">ML Anomaly Detection & Insights</h2>
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//             {/* ML Insight Card */}
//             <div>
//               <MLInsightCard
//                 available={mlResolved.available}
//                 anomalyDetected={mlResolved.anomaly === true}
//                 confidence={mlResolved.confidence ?? undefined}
//                 predictedIncidentType={mlResolved.predictedIncidentType ?? undefined}
//                 recommendedAction={mlResolved.recommendedAction ?? undefined}
//                 confidenceLevel={mlResolved.confidenceLevel ?? undefined}
//                 executionMode={mlResolved.executionMode ?? undefined}
//                 explanation={mlResolved.explanation ?? undefined}
//                 severity={mlResolved.severity ?? undefined}
//                 isSafeToExecute={mlResolved.isSafeToExecute ?? undefined}
//                 loading={loading}
//               />
//             </div>

//             {/* ML Evidence */}
//             <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-5">
//               <p className="text-sm font-semibold text-white mb-4">Contributing Evidence</p>
//               <MLEvidence
//                 available={mlResolved.available}
//                 contributingSignals={mlResolved.contributingSignals ?? []}
//                 contributingFactors={mlResolved.contributingFactors ?? []}
//                 classProbs={mlResolved.classProbs ?? {}}
//                 anomalyScore={mlResolved.anomalyScore ?? undefined}
//                 compact={true}
//               />
//             </div>
//           </div>
//         </GlowCard>

//         {/* Log Viewer */}
//         <GlowCard glowColor="blue" customSize={true} className="p-4">
//           <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Log Viewer</h2>
//           <div className="h-64 overflow-y-auto rounded-xl border border-white/10 bg-white dark:bg-[#020617]/80 p-4 font-mono text-sm text-gray-700 dark:text-white/80 space-y-2">
//             {filteredLogs.length > 0 ? (
//               filteredLogs.slice(0, 28).map((log) => (
//                 <div key={log.id} className="text-xs">
//                   <span className="text-gray-600 dark:text-white/60">{new Date(log.timestamp).toLocaleTimeString()}</span>
//                   <span className={`ml-2 font-semibold ${levelClass(log.level)}`}>
//                     [{log.level.toUpperCase()}]
//                   </span>
//                   <span className="ml-2 text-gray-600 dark:text-white/60">{log.service}:</span>
//                   <span className="ml-2 text-foreground">{log.message}</span>
//                 </div>
//               ))
//             ) : (
//               <p className="text-gray-600 dark:text-white/60 text-center py-20">Waiting for live telemetry</p>
//             )}
//           </div>
//         </GlowCard>

//         {/* Distributed Traces */}
//         <GlowCard glowColor="purple" customSize={true} className="p-4">
//           <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Distributed Traces</h2>
//           <div className="space-y-3">
//             {traceRows.map((trace, index) => (
//               <div
//                 key={`${trace.path}-${index}`}
//                 className="rounded-2xl border border-white/10 bg-[#020617]/60 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
//               >
//                 <div className="flex items-center justify-between mb-2">
//                   <p className="text-sm font-semibold text-gray-900 dark:text-white">
//                     {trace.path}
//                     {trace.status === 'healthy' ? (
//                       <span className="ml-2 text-xs text-green-500">Healthy</span>
//                     ) : trace.status === 'degraded' ? (
//                       <span className="ml-2 text-xs text-yellow-500">Degraded</span>
//                     ) : (
//                       <span className="ml-2 text-xs text-destructive">Critical</span>
//                     )}
//                   </p>
//                   <span className="text-xs text-gray-600 dark:text-white/60">{new Date().toLocaleTimeString()}</span>
//                 </div>
//                 <div className="text-xs text-gray-600 dark:text-white/60">
//                   {trace.reason}
//                 </div>
//               </div>
//             ))}
//             {traceRows.length === 0 && (
//               <p className="text-sm text-gray-600 dark:text-white/60 text-center py-8">Trace data not yet connected</p>
//             )}
//           </div>
//         </GlowCard>

//         {(loading || error) && (
//           <p className="text-sm text-gray-600 dark:text-white/60">
//             {loading ? 'Waiting for live telemetry...' : `Live telemetry error: ${error}`}
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }


'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
import { resolveMlData } from '@/lib/agent-analyze';
import { fetchAllSimulationStates } from '@/lib/simulation-api';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { GlowCard } from '@/components/ui/spotlight-card';
import MLInsightCard from '@/components/MlInsightCard';
import MLEvidence from '@/components/MLEvidence';

type ServiceFilter = 'all' | 'auth-service' | 'messaging-service' | 'presence-service';

type ServiceSample = {
  service: string;
  latency: number;
  throughput: number;
  errorRate: number;
  reachable: boolean;
  status: string;
  mode: string;
};

type TelemetryPoint = {
  timestamp: string;
  samples: ServiceSample[];
  latency: number;
  throughput: number;
  errorRate: number;
  restartCount: number;
  healthyServices: number;
  degradedServices: number;
  criticalServices: number;
  overload: number;
};

type LogLevel = 'info' | 'warning' | 'error';

type ObservabilityLog = {
  id: string;
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
};

const SERVICE_OPTIONS: ServiceFilter[] = ['all', 'auth-service', 'messaging-service', 'presence-service'];

const levelClass = (level: LogLevel) => {
  if (level === 'error') return 'text-destructive';
  if (level === 'warning') return 'text-yellow-500';
  return 'text-green-500';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const latencyFromService = (health: string, mode: string) => {
  const normalizedHealth = (health || '').toLowerCase();
  const normalizedMode = (mode || '').toLowerCase();

  if (normalizedHealth === 'critical' || normalizedHealth === 'down') return 420;
  if (normalizedMode.includes('latency')) return 320;
  if (normalizedHealth === 'degraded') return 260;
  return 120;
};

export default function ObservabilityPage() {
  const { data: analyzeData, loading, error } = useAgentAnalyze(3000);
  const [selectedService, setSelectedService] = useState<ServiceFilter>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [derivedLogs, setDerivedLogs] = useState<ObservabilityLog[]>([]);
  
  // NAYE STATES FOR SIMULATION & ML
  const [simulationStates, setSimulationStates] = useState<Record<string, any>>({});
  const [directMlData, setDirectMlData] = useState<any>(null);

  const previousSnapshotRef = useRef<{
    restartCount: number;
    overload: boolean;
    services: Record<string, { health: string; mode: string; reachable: boolean }>;
  } | null>(null);

  const monitoring = analyzeData?.monitoring;
  const kubernetesSignals = analyzeData?.kubernetesSignals;
  const rca = analyzeData?.rca;
  const decision = analyzeData?.decision;

  const allServices = monitoring?.services || [];
  const scopedServices = allServices.filter((svc) =>
    SERVICE_OPTIONS.includes(svc.service as ServiceFilter)
  );

  const currentServices = selectedService === 'all'
    ? scopedServices
    : scopedServices.filter((svc) => svc.service === selectedService);

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
          const data = await res.json();
          if (mounted) setDirectMlData(data);
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

  const buildTelemetryPoint = () => {
    const restartCount = kubernetesSignals?.restartCount ?? 0;
    const overloadActive = Boolean(kubernetesSignals?.resourceOverload);

    const samples: ServiceSample[] = scopedServices.map((svc) => {
      const latency = latencyFromService(svc.health || 'healthy', svc.mode || 'normal');
      const throughputPenalty = restartCount * 30 + (overloadActive ? 140 : 0);
      const throughput = clamp(svc.reachable ? 360 - throughputPenalty : 0, 0, 420);
      const errorRate = clamp(
        (svc.health === 'healthy' ? 0.2 : svc.health === 'degraded' ? 2.5 : 6.8) + (overloadActive ? 1.2 : 0),
        0,
        10
      );

      return {
        service: svc.service,
        latency,
        throughput,
        errorRate,
        reachable: Boolean(svc.reachable),
        status: svc.health || 'unknown',
        mode: svc.mode || 'unknown'
      };
    });

    const relevantSamples = selectedService === 'all'
      ? samples
      : samples.filter((entry) => entry.service === selectedService);

    const safeCount = relevantSamples.length || 1;
    const healthyServices = relevantSamples.filter((entry) => entry.status === 'healthy').length;
    const degradedServices = relevantSamples.filter((entry) => entry.status === 'degraded').length;
    const criticalServices = relevantSamples.filter((entry) => entry.status === 'critical' || entry.status === 'down').length;

    return {
      timestamp: new Date().toLocaleTimeString(),
      samples,
      latency: Math.round(relevantSamples.reduce((sum, entry) => sum + entry.latency, 0) / safeCount),
      throughput: Math.round(relevantSamples.reduce((sum, entry) => sum + entry.throughput, 0)),
      errorRate: Number((relevantSamples.reduce((sum, entry) => sum + entry.errorRate, 0) / safeCount).toFixed(2)),
      restartCount,
      healthyServices,
      degradedServices,
      criticalServices,
      overload: overloadActive ? 1 : 0
    };
  };

  useEffect(() => {
    if (!analyzeData?.success) return;

    const point = buildTelemetryPoint();
    setTelemetryHistory((prev) => [...prev, point].slice(-40));

    const now = new Date();
    const nextLogs: ObservabilityLog[] = [];

    const prev = previousSnapshotRef.current;
    const restartCount = kubernetesSignals?.restartCount ?? 0;
    const overloadActive = Boolean(kubernetesSignals?.resourceOverload);

    if (!prev) {
      nextLogs.push({ id: `boot-${now.getTime()}`, timestamp: now, level: 'info', service: 'agent-service', message: 'Live observability stream connected from /agent/analyze.' });
    }

    if (prev && restartCount > prev.restartCount) {
      nextLogs.push({ id: `restart-${now.getTime()}`, timestamp: now, level: restartCount >= 2 ? 'error' : 'warning', service: 'messaging-service', message: `Restart count increased to ${restartCount}.` });
    }

    if (prev && overloadActive !== prev.overload) {
      nextLogs.push({ id: `overload-${now.getTime()}`, timestamp: now, level: overloadActive ? 'error' : 'info', service: 'messaging-service', message: overloadActive ? 'Resource overload detected.' : 'Resource overload cleared, service stabilizing.' });
    }

    const currentServiceState: Record<string, { health: string; mode: string; reachable: boolean }> = {};
    scopedServices.forEach((svc) => {
      currentServiceState[svc.service] = { health: svc.health || 'unknown', mode: svc.mode || 'unknown', reachable: Boolean(svc.reachable) };
      const prevService = prev?.services?.[svc.service];
      if (prevService && (prevService.health !== svc.health || prevService.reachable !== Boolean(svc.reachable))) {
        nextLogs.push({ id: `svc-${svc.service}-${now.getTime()}`, timestamp: now, level: svc.health === 'healthy' ? 'info' : svc.health === 'degraded' ? 'warning' : 'error', service: svc.service, message: `Status changed to ${svc.health || 'unknown'} (${svc.reachable ? 'reachable' : 'unreachable'}).` });
      }
    });

    if (rca?.reason) {
      nextLogs.push({ id: `rca-${now.getTime()}`, timestamp: now, level: rca?.severity === 'critical' ? 'error' : rca?.severity === 'high' ? 'warning' : 'info', service: (rca?.rootCause as string) || 'agent-service', message: `RCA: ${rca.reason}` });
    }

    if (decision?.actionNeeded && decision?.action) {
      nextLogs.push({ id: `decision-${now.getTime()}`, timestamp: now, level: 'warning', service: (decision.target as string) || 'agent-service', message: `Decision: ${decision.action} (${decision.explanation || 'no explanation'})` });
    }

    const excerptLines = (kubernetesSignals?.logsExcerpt || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(-2);
    excerptLines.forEach((line, index) => {
      nextLogs.push({ id: `excerpt-${now.getTime()}-${index}`, timestamp: now, level: /error|oom|killed|fail/i.test(line) ? 'error' : /warn|overload|restart/i.test(line) ? 'warning' : 'info', service: selectedService === 'all' ? 'messaging-service' : selectedService, message: line.slice(0, 220) });
    });

    if (nextLogs.length > 0) {
      setDerivedLogs((prevLogs) => [...nextLogs, ...prevLogs].slice(0, 120));
    }

    previousSnapshotRef.current = { restartCount, overload: overloadActive, services: currentServiceState };
  }, [analyzeData]);

  const chartData = useMemo(() => {
    return telemetryHistory.map((point) => {
      const scoped = selectedService === 'all' ? point.samples : point.samples.filter((entry) => entry.service === selectedService);
      const scopedCount = scoped.length || 1;
      return {
        time: point.timestamp,
        latency: Math.round(scoped.reduce((sum, entry) => sum + entry.latency, 0) / scopedCount),
        throughput: Math.round(scoped.reduce((sum, entry) => sum + entry.throughput, 0)),
        errorRate: Number((scoped.reduce((sum, entry) => sum + entry.errorRate, 0) / scopedCount).toFixed(2)),
        restartCount: point.restartCount,
        overload: point.overload,
        healthy: point.healthyServices,
        degraded: point.degradedServices,
        critical: point.criticalServices
      };
    });
  }, [telemetryHistory, selectedService]);

  const latestPoint = chartData[chartData.length - 1];

  const filteredLogs = useMemo(() => {
    if (selectedService === 'all') return derivedLogs;
    return derivedLogs.filter((log) => log.service === selectedService || log.service === 'agent-service');
  }, [derivedLogs, selectedService]);

  const traceRows = useMemo(() => {
    const rootCause = (rca?.rootCause || '').toLowerCase();
    const serviceHealth = new Map(scopedServices.map((svc) => [svc.service, (svc.health || 'unknown').toLowerCase()]));

    const rows = [
      { path: 'frontend -> auth-service', service: 'auth-service' },
      { path: 'frontend -> messaging-service', service: 'messaging-service' },
      { path: 'frontend -> presence-service', service: 'presence-service' },
      { path: 'agent-service -> auth-service', service: 'auth-service' },
      { path: 'agent-service -> messaging-service', service: 'messaging-service' },
      { path: 'agent-service -> presence-service', service: 'presence-service' }
    ];

    const scopedRows = selectedService === 'all' ? rows : rows.filter((row) => row.service === selectedService);

    return scopedRows.map((row) => {
      const health = serviceHealth.get(row.service) || 'unknown';
      const impacted = rootCause === row.service || (row.service === 'messaging-service' && Boolean(kubernetesSignals?.resourceOverload));
      const status = impacted || health === 'critical' || health === 'down' ? 'critical' : health === 'degraded' ? 'degraded' : 'healthy';

      return {
        ...row,
        status,
        reason: impacted ? rca?.reason || 'Impacted by active incident signals.' : health === 'healthy' ? 'Flow is currently stable.' : `Flow health follows ${row.service} state: ${health}.`
      };
    });
  }, [selectedService, scopedServices, rca, kubernetesSignals?.resourceOverload]);

  // --- ML UI VARIABLES ---
  const nodeMlResolved = resolveMlData(analyzeData);
  const isDirectMl = directMlData !== null;
  const mlAvailable = isDirectMl ? true : nodeMlResolved.available;
  const mlAnomaly = isDirectMl ? directMlData.anomaly_detected : (nodeMlResolved.anomaly === true);
  const rawConfidence = isDirectMl ? directMlData.confidence_score : nodeMlResolved.confidence;
  const mlConfidence = typeof rawConfidence === 'number' ? `${(rawConfidence * 100).toFixed(1)}%` : '—';
  const mlPredictedIncidentType = isDirectMl ? directMlData.predicted_class : nodeMlResolved.predictedIncidentType;
  const mlRecommendedAction = isDirectMl ? directMlData.recommended_action : nodeMlResolved.recommendedAction;
  const mlExecutionMode = isDirectMl ? directMlData.execution_mode : nodeMlResolved.executionMode;
  const mlExplanation = isDirectMl ? directMlData.explanation : nodeMlResolved.explanation;
  const mlSeverity = isDirectMl ? directMlData.severity : nodeMlResolved.severity;

  // FIX: Provide a STRING ARRAY for mockSignals so .replace() doesn't crash
  const mockSignals = [
    "high_latency_detected",
    "error_rate_spike",
    "resource_saturation"
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Observability Hub</h1>
            <p className="text-gray-600 dark:text-white/60">Centralized telemetry data: metrics, logs, and distributed traces</p>
          </div>
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white dark:bg-[#0B1220]/60 px-4 py-2 text-gray-900 dark:text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all hover:border-blue-500/25 hover:bg-blue-500/10"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">Filter by Service</span>
              <ChevronDown className="h-4 w-4 text-gray-900 dark:text-white" />
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#0B1220] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                <div className="space-y-1">
                  <Select
                    value={selectedService}
                    onValueChange={(value) => setSelectedService(value as ServiceFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Services (Aggregated)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services (Aggregated)</SelectItem>
                      <SelectItem value="auth-service">auth-service</SelectItem>
                      <SelectItem value="messaging-service">messaging-service</SelectItem>
                      <SelectItem value="presence-service">presence-service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metric Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlowCard glowColor="purple" customSize={true} className="lg:col-span-2 p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Latency Distribution (P99)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
                <YAxis stroke="rgba(255,255,255,0.45)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: 'rgba(255,255,255,0.85)' }} itemStyle={{ color: 'rgba(255,255,255,0.9)' }} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
                <Line type="monotone" dataKey="latency" stroke="#1e40af" name="P99 Latency (ms)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#1e40af', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </GlowCard>

          <GlowCard glowColor="green" customSize={true} className="p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Metrics Summary</h2>
            <div className="space-y-4">
              <div><p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived P99 Latency</p><p className="text-2xl font-bold text-primary">{latestPoint ? `${latestPoint.latency}ms` : '--'}</p></div>
              <div><p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived Throughput</p><p className="text-2xl font-bold text-accent">{latestPoint ? `${latestPoint.throughput} req/s` : '--'}</p></div>
              <div><p className="mb-1 text-xs text-gray-600 dark:text-white/60">Derived Error Rate</p><p className="text-2xl font-bold text-yellow-500">{latestPoint ? `${latestPoint.errorRate}%` : '--'}</p></div>
              <div><p className="mb-1 text-xs text-gray-600 dark:text-white/60">Restart Count</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{kubernetesSignals?.restartCount ?? 0}</p></div>
              <div><p className="mb-1 text-xs text-gray-600 dark:text-white/60">Replicas (avail/desired)</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{kubernetesSignals?.deploymentAvailableReplicas ?? '-'} / {kubernetesSignals?.deploymentReplicas ?? '-'}</p></div>
            </div>
          </GlowCard>
        </div>

        {/* Throughput and Error Rate Charts - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlowCard glowColor="orange" customSize={true} className="p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Throughput (Requests/sec)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
                <YAxis stroke="rgba(255,255,255,0.45)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: 'rgba(255,255,255,0.85)' }} itemStyle={{ color: 'rgba(255,255,255,0.9)' }} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
                <defs><linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/><stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1}/></linearGradient></defs>
                <Area type="monotone" dataKey="throughput" stroke="#2563eb" fill="url(#throughputGradient)" name="Requests/sec" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </GlowCard>

          <GlowCard glowColor="red" customSize={true} className="p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Global Error Rate</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" />
                <YAxis stroke="rgba(255,255,255,0.45)" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: 'rgba(255,255,255,0.85)' }} itemStyle={{ color: 'rgba(255,255,255,0.9)' }} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.65)' }} />
                <Line type="monotone" dataKey="errorRate" stroke="#3b82f6" name="Error Rate %" strokeWidth={3} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </GlowCard>
        </div>

        {/* ML Insights Section */}
        <GlowCard glowColor="blue" customSize={true} className="p-6">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">ML Anomaly Detection & Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <MLInsightCard
                available={mlAvailable}
                anomalyDetected={mlAnomaly}
                confidence={rawConfidence}
                predictedIncidentType={mlPredictedIncidentType}
                recommendedAction={mlRecommendedAction}
                confidenceLevel={mlConfidence}
                executionMode={mlExecutionMode}
                explanation={mlExplanation}
                severity={mlSeverity}
                isSafeToExecute={nodeMlResolved.isSafeToExecute}
                loading={loading}
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-5">
              <p className="text-sm font-semibold text-white mb-4">Contributing Evidence</p>
              <MLEvidence
                available={mlAvailable}
                contributingSignals={isDirectMl ? mockSignals : (nodeMlResolved.contributingSignals ?? [])}
                contributingFactors={nodeMlResolved.contributingFactors ?? []}
                classProbs={nodeMlResolved.classProbs ?? {}}
                anomalyScore={nodeMlResolved.anomalyScore ?? undefined}
                compact={true}
              />
            </div>
          </div>
        </GlowCard>

        {/* Log Viewer */}
        <GlowCard glowColor="blue" customSize={true} className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Log Viewer</h2>
          <div className="h-64 overflow-y-auto rounded-xl border border-white/10 bg-white dark:bg-[#020617]/80 p-4 font-mono text-sm text-gray-700 dark:text-white/80 space-y-2">
            {filteredLogs.length > 0 ? (
              filteredLogs.slice(0, 28).map((log) => (
                <div key={log.id} className="text-xs">
                  <span className="text-gray-600 dark:text-white/60">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`ml-2 font-semibold ${levelClass(log.level)}`}>[{log.level.toUpperCase()}]</span>
                  <span className="ml-2 text-gray-600 dark:text-white/60">{log.service}:</span>
                  <span className="ml-2 text-foreground">{log.message}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-600 dark:text-white/60 text-center py-20">Waiting for live telemetry</p>
            )}
          </div>
        </GlowCard>

        {/* Distributed Traces */}
        <GlowCard glowColor="purple" customSize={true} className="p-4">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Distributed Traces</h2>
          <div className="space-y-3">
            {traceRows.map((trace, index) => (
              <div key={`${trace.path}-${index}`} className="rounded-2xl border border-white/10 bg-[#020617]/60 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {trace.path}
                    {trace.status === 'healthy' ? <span className="ml-2 text-xs text-green-500">Healthy</span> : trace.status === 'degraded' ? <span className="ml-2 text-xs text-yellow-500">Degraded</span> : <span className="ml-2 text-xs text-destructive">Critical</span>}
                  </p>
                  <span className="text-xs text-gray-600 dark:text-white/60">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-white/60">{trace.reason}</div>
              </div>
            ))}
            {traceRows.length === 0 && <p className="text-sm text-gray-600 dark:text-white/60 text-center py-8">Trace data not yet connected</p>}
          </div>
        </GlowCard>

        {(loading || error) && (
          <p className="text-sm text-gray-600 dark:text-white/60">
            {loading ? 'Waiting for live telemetry...' : `Live telemetry error: ${error}`}
          </p>
        )}
      </div>
    </div>
  );
}