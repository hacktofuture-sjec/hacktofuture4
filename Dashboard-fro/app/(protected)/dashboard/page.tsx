'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, PerformanceMetric } from '@/hooks/useAppStore';
import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
import { resolveMlData } from '@/lib/agent-analyze';
import { fetchSecurityTelemetry, type SecurityAlert, type SecurityStatus } from '@/lib/security-api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, Zap, Activity, CheckCircle } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';

export default function DashboardPage() {
  const store = useAppStore();
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const { data: analyzeData, loading: analyzeLoading, error: analyzeError, lastUpdated } = useAgentAnalyze(4000);

  // Simulate real-time performance data
  useEffect(() => {
    const interval = setInterval(() => {
      const metric: PerformanceMetric = {
        timestamp: new Date(),
        cpu: 30 + Math.random() * 40,
        memory: 40 + Math.random() * 40,
        latency: 50 + Math.random() * 200,
        errorRate: Math.random() * 3,
      };
      store.addPerformanceMetric(metric);
    }, 5000);

    return () => clearInterval(interval);
  }, [store]);

  // Format data for charts
  useEffect(() => {
    const formatted = store.performanceHistory.map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      cpu: Math.round(m.cpu),
      memory: Math.round(m.memory),
      latency: Math.round(m.latency),
      errorRate: m.errorRate.toFixed(2),
    }));
    setPerformanceData(formatted);
  }, [store.performanceHistory]);

  useEffect(() => {
    let mounted = true;

    const refreshSecurity = async () => {
      try {
        const telemetry = await fetchSecurityTelemetry(8);
        if (!mounted) return;
        setSecurityStatus(telemetry.status);
        setSecurityAlerts(telemetry.alerts);
        setSecurityError(null);
      } catch (err) {
        if (!mounted) return;
        setSecurityError(err instanceof Error ? err.message : 'Security telemetry unavailable');
      }
    };

    refreshSecurity();
    const timer = window.setInterval(refreshSecurity, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  // Calculate overview metrics
  const totalServices = store.services.length;
  const avgCpu = Math.round(
    store.services.reduce((sum, s) => sum + s.cpu, 0) / totalServices
  );
  const avgLatency = Math.round(
    store.services.reduce((sum, s) => sum + s.latency, 0) / totalServices
  );
  const activeIncidents = store.incidents.filter((i) => i.status === 'open').length;

  // Get top services by CPU
  const topServices = [...store.services]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 8);

  // Get recent anomalies
  const recentAnomalies = store.anomalies.slice(0, 5);

  const monitoring = analyzeData?.monitoring;
  const kubernetesSignals = analyzeData?.kubernetesSignals;
  const rca = analyzeData?.rca;
  const decision = analyzeData?.decision;
  const mlResolved = resolveMlData(analyzeData);
  const liveServices = monitoring?.services ?? [];

  const findService = (name: string) => liveServices.find((entry) => entry.service === name);

  const fallbackOverall = () => {
    if (kubernetesSignals?.resourceOverload) return 'critical';
    if ((kubernetesSignals?.restartCount ?? 0) > 0 && decision?.actionNeeded) return 'degraded';
    if (rca?.rootCause) return 'degraded';
    return 'healthy';
  };

  const systemStatus = (monitoring?.overall || fallbackOverall()).toLowerCase();
  const statusColor = systemStatus === 'critical'
    ? 'text-red-500'
    : systemStatus === 'degraded'
      ? 'text-yellow-500'
      : 'text-green-500';
  const statusGlow = systemStatus === 'critical' ? 'red' : systemStatus === 'degraded' ? 'orange' : 'green';
  const hasCrashSignal = systemStatus === 'critical' || Boolean(kubernetesSignals?.resourceOverload);
  const isStableSignal = systemStatus === 'healthy' && !kubernetesSignals?.resourceOverload;
  const blinkDotClass = hasCrashSignal
    ? 'bg-red-500 animate-ping'
    : isStableSignal
      ? 'bg-green-500 animate-ping'
      : 'bg-yellow-500 animate-pulse';
  const blinkBadgeClass = hasCrashSignal
    ? 'bg-red-500/10 border-red-500/30'
    : isStableSignal
      ? 'bg-green-500/10 border-green-500/30'
      : 'bg-yellow-500/10 border-yellow-500/30';

  const serviceHealthClass = (health?: string) => {
    const normalized = (health || '').toLowerCase();
    if (normalized === 'critical' || normalized === 'down') return 'text-red-500';
    if (normalized === 'degraded') return 'text-yellow-500';
    return 'text-green-500';
  };

  const mlAvailable = mlResolved.available;
  const mlAnomaly = mlResolved.anomaly === true;
  const mlConfidence = typeof mlResolved.confidence === 'number' ? `${(mlResolved.confidence * 100).toFixed(1)}%` : '—';
  const mlStrongConfidence = typeof mlResolved.confidence === 'number' && mlResolved.confidence > 0.8;

  const securityOverall = (securityStatus?.overall || 'secure').toLowerCase();
  const securityGlow = securityOverall === 'threat_detected' ? 'red' : securityOverall === 'suspicious' ? 'orange' : 'green';
  const securityOverallClass =
    securityOverall === 'threat_detected'
      ? 'text-red-500'
      : securityOverall === 'suspicious'
        ? 'text-yellow-500'
        : 'text-green-500';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Analytics Dashboard</h1>
            <p className="text-gray-600 dark:text-white/60">Real-time system metrics and resource utilization</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${blinkBadgeClass}`}>
              <div className={`w-2 h-2 rounded-full ${blinkDotClass}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Live</span>
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column - Main Analytics */}
          <div className="xl:col-span-8 space-y-6">
            {/* Hero Analytics Card */}
            <GlowCard 
              glowColor="purple"
              customSize={true}
              className="min-h-[400px]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">Performance Analytics</h2>
                  <p className="text-sm text-gray-600 dark:text-white/60">Real-time system metrics and resource utilization</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-900 dark:text-white">Live</span>
                </div>
              </div>
              {performanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e40af" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={11} 
                      tickMargin={12}
                    />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickMargin={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        backdropFilter: 'blur(12px)',
                        fontSize: '11px'
                      }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '24px', color: 'rgba(255,255,255,0.85)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cpu"
                      stroke="#1e40af"
                      strokeWidth={3}
                      fill="url(#colorCpu)"
                      name="CPU %"
                      activeDot={{ r: 10, fill: '#1e40af', stroke: '#fff', strokeWidth: 3 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      stroke="#1e3a8a"
                      strokeWidth={3}
                      fill="url(#colorMemory)"
                      name="Memory %"
                      activeDot={{ r: 10, fill: '#1e3a8a', stroke: '#fff', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-80 items-center justify-center text-gray-600 dark:text-white/60">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20">
                      <Activity className="h-8 w-8 text-gray-500 dark:text-white/40" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/60">Initializing performance monitoring...</p>
                  </div>
                </div>
              )}
            </GlowCard>

            {/* Secondary Analytics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Regional Health */}
              <GlowCard 
                glowColor="green"
                customSize={true}
                className="min-h-[320px]"
              >
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Regional Health</h3>
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-gray-600 dark:text-white/60">Geographic performance</h4>
                      <p className="text-xs text-gray-500 dark:text-white/50">Service health by region</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {['us-east', 'eu-west', 'asia-south'].map((region, idx) => {
                      const services = store.services.filter((s) => s.region === region);
                      const health = services.length > 0 
                        ? (services.filter((s) => s.status === 'healthy').length / services.length) * 100 
                        : 0;
                      const displayName = region === 'us-east' ? 'US-East' : region === 'eu-west' ? 'EU-West' : 'Asia-South';
                      const healthColor = health > 80 ? 'from-green-500 to-emerald-500' : health > 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500';
                      return (
                        <div key={region} className="group">
                          <div className="flex justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${health > 80 ? 'bg-green-500' : health > 50 ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-700 dark:text-white/80">{Math.round(health)}%</span>
                          </div>
                          <div className="h-2 bg-white/10 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${healthColor} transition-all duration-700 ease-out rounded-full`}
                              style={{ width: `${health}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlowCard>

              {/* Resource Allocation */}
              <GlowCard 
                glowColor="purple"
                customSize={true}
                className="min-h-[320px]"
              >
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Resource Allocation</h3>
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-gray-600 dark:text-white/60">Service utilization</h4>
                      <p className="text-xs text-gray-500 dark:text-white/50">Top services by CPU</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                  {topServices.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topServices}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.35)" fontSize={10} tickMargin={12} angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickMargin={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '12px',
                            color: '#f8fafc',
                            backdropFilter: 'blur(12px)',
                            fontSize: '11px'
                          }}
                          itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                        />
                        <Bar dataKey="cpu" fill="url(#colorBar)" name="CPU %" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.7}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-60 items-center justify-center text-gray-600 dark:text-white/60">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20">
                          <Zap className="h-8 w-8 text-gray-500 dark:text-white/40" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-white/60">No service data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </GlowCard>
            </div>
          </div>

          {/* Right Column - Supporting Stats */}
          <div className="xl:col-span-4 space-y-6">
            {/* Key Metrics Cards */}
            <div className="space-y-4">
              <GlowCard 
                glowColor={statusGlow as 'green' | 'blue' | 'purple' | 'orange' | 'red'}
                customSize={true}
                className="w-full"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">System Status</p>
                    <p className={`text-3xl font-bold capitalize ${statusColor} tracking-tight`}>{systemStatus}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                      {analyzeLoading ? 'Loading live analysis...' : analyzeError ? 'Live analysis unavailable' : 'Live from /agent/analyze'}
                    </p>
                  </div>
                  <div className="relative">
                    {isStableSignal ? (
                      <div className="relative">
                        <CheckCircle className="h-12 w-12 text-green-500/20" />
                        <CheckCircle className="h-12 w-12 text-green-500 absolute inset-0 animate-ping" />
                      </div>
                    ) : hasCrashSignal ? (
                      <div className="relative">
                        <AlertTriangle className="h-12 w-12 text-red-500/20" />
                        <AlertTriangle className="h-12 w-12 text-red-500 absolute inset-0 animate-ping" />
                      </div>
                    ) : (
                      <AlertTriangle className="h-12 w-12 text-yellow-500/60 animate-pulse" />
                    )}
                  </div>
                </div>
              </GlowCard>

              <GlowCard 
                glowColor="blue"
                customSize={true}
                className="w-full"
              >
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">Service Health</p>
                  <div className="space-y-2">
                    {['auth-service', 'messaging-service', 'presence-service'].map((serviceName) => {
                      const service = findService(serviceName);
                      return (
                        <div key={serviceName} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{serviceName}</p>
                            <p className="text-xs text-gray-600 dark:text-white/60">Mode: {service?.mode || 'unknown'}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold capitalize ${serviceHealthClass(service?.health)}`}>{service?.health || 'unknown'}</p>
                            <p className="text-xs text-gray-600 dark:text-white/60">{service?.reachable ? 'Reachable' : 'Unreachable'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlowCard>

              <GlowCard 
                glowColor="orange"
                customSize={true}
                className="w-full"
              >
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">Kubernetes Signals</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Restarts</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{kubernetesSignals?.restartCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Replicas</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{kubernetesSignals?.deploymentReplicas ?? '-'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Available</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{kubernetesSignals?.deploymentAvailableReplicas ?? '-'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Overload</p>
                      <p className={`font-semibold ${kubernetesSignals?.resourceOverload ? 'text-red-500' : 'text-green-500'}`}>
                        {kubernetesSignals?.resourceOverload ? 'true' : 'false'}
                      </p>
                    </div>
                  </div>
                </div>
              </GlowCard>

              <GlowCard 
                glowColor="purple"
                customSize={true}
                className="w-full"
              >
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">RCA Summary</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{rca?.rootCause || 'none'}</p>
                    <p className="text-xs text-gray-600 dark:text-white/60">{rca?.reason || 'No active issue detected'}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Severity</p>
                    <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{rca?.severity || 'none'}</p>
                  </div>

                  <div className="border-t border-white/10 pt-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">Decision Summary</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-semibold">Action Needed:</span> {decision?.actionNeeded ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-semibold">Action:</span> {decision?.action || 'none'}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-semibold">Target:</span> {decision?.target || 'n/a'}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">{decision?.explanation || 'No remediation required.'}</p>
                  </div>
                </div>
              </GlowCard>

              <GlowCard
                glowColor={mlAnomaly ? 'red' : 'green'}
                customSize={true}
                className="w-full"
              >
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">ML Insights</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {mlAvailable ? 'Active' : 'ML data not available'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Anomaly</p>
                      <p className={`font-semibold ${mlAnomaly ? 'text-red-500' : 'text-green-500'}`}>{mlAvailable ? (mlAnomaly ? 'Yes' : 'No') : '—'}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${mlStrongConfidence ? 'border-red-500/30 bg-red-500/10' : 'border-white/10'}`}>
                      <p className="text-xs text-gray-600 dark:text-white/60">Confidence</p>
                      <p className={`font-semibold ${mlStrongConfidence ? 'text-red-400' : 'text-gray-900 dark:text-white'}`}>{mlConfidence}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Service</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{mlResolved.service || '—'}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    <p className="text-xs text-gray-600 dark:text-white/60">Reason</p>
                    <p className="text-xs text-gray-900 dark:text-white/80">{mlResolved.reason || 'ML data not available'}</p>
                  </div>
                </div>
              </GlowCard>

              <GlowCard
                glowColor={securityGlow as 'green' | 'blue' | 'purple' | 'orange' | 'red'}
                customSize={true}
                className="w-full"
              >
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">Security Status</p>
                    <p className={`text-sm font-semibold capitalize ${securityOverallClass}`}>
                      {securityStatus?.overall || 'secure'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-white/60">
                      {securityError ? 'Security telemetry unavailable' : 'Live from security-service'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Threat Level</p>
                      <p className="font-semibold capitalize text-gray-900 dark:text-white">{securityStatus?.threatLevel || 'low'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Active Alerts</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{securityStatus?.activeAlerts ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Suspicious Sources</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{securityStatus?.suspiciousSources?.length ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-600 dark:text-white/60">Blocked Sources</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{securityStatus?.blockedSources?.length ?? 0}</p>
                    </div>
                  </div>
                </div>
              </GlowCard>

              <GlowCard
                glowColor="orange"
                customSize={true}
                className="w-full"
              >
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white/60">Recent Security Alerts</p>
                    <p className="text-xs text-gray-600 dark:text-white/60">Brute-force, suspicious traffic, and abuse telemetry</p>
                  </div>

                  {securityError ? (
                    <p className="rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-white/60">Security telemetry unavailable</p>
                  ) : securityAlerts.length === 0 ? (
                    <p className="rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-600 dark:text-white/60">No active security alerts</p>
                  ) : (
                    <div className="space-y-2">
                      {securityAlerts.slice(0, 4).map((alert) => (
                        <div key={alert.id} className="rounded-xl border border-white/10 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">{alert.type}</p>
                            <span className={`text-[10px] font-semibold uppercase ${alert.severity === 'high' || alert.severity === 'critical' ? 'text-red-400' : alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-600 dark:text-white/70">{alert.message}</p>
                          <p className="mt-1 text-[10px] text-gray-500 dark:text-white/50">{alert.service} • {alert.sourceIp}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlowCard>
            </div>

            {lastUpdated && (
              <p className="text-xs text-right text-gray-500 dark:text-white/50">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
            {analyzeError && (
              <p className="text-xs text-red-500">Live backend error: {analyzeError}</p>
            )}
          </div>
        </div>

        {/* Bottom Section - Recent Anomalies */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <GlowCard 
            glowColor="orange"
            customSize={true}
            className="min-h-[320px]"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Anomalies</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="mb-1 text-sm font-medium text-gray-600 dark:text-white/60">Latest detections</h4>
                  <p className="text-xs text-gray-500 dark:text-white/50">AI-powered anomaly detection</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
              </div>
              <div className="space-y-3">
                {recentAnomalies.length > 0 ? (
                  recentAnomalies.map((anomaly) => (
                    <InternalGlassPanel
                      key={anomaly.id}
                      density="compact"
                      className="group transition-all hover:shadow-[0_10px_36px_rgba(0,0,0,0.34)]"
                    >
                      <div className="flex items-start gap-4">
                      <div className="relative">
                        <div
                          className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                            anomaly.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                        />
                        <div className={`absolute inset-0 w-3 h-3 rounded-full ${
                          anomaly.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                        } animate-ping opacity-75`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{anomaly.serviceName}</p>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            anomaly.severity === 'critical' 
                              ? 'bg-red-500/20 text-red-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {anomaly.severity}
                          </span>
                        </div>
                        <p className="mb-2 text-xs text-gray-600 dark:text-white/60">{anomaly.metric}</p>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-blue-400" />
                          <p className="text-xs text-blue-400 font-semibold">+{anomaly.deviation.toFixed(1)}% deviation</p>
                        </div>
                      </div>
                      </div>
                    </InternalGlassPanel>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-500/40" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/60">All systems operating normally</p>
                  </div>
                )}
              </div>
            </div>
          </GlowCard>

          {/* Additional Insights Card */}
          <GlowCard 
            glowColor="green"
            customSize={true}
            className="min-h-[320px]"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">System Insights</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="mb-1 text-sm font-medium text-gray-600 dark:text-white/60">Performance trends</h4>
                  <p className="text-xs text-gray-500 dark:text-white/50">Key system metrics</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InternalGlassPanel density="compact">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-green-500/20">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Success Rate</span>
                  </div>
                  <p className="text-2xl font-black text-green-400">99.8%</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/50">Last 24 hours</p>
                </InternalGlassPanel>
                <InternalGlassPanel density="compact">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-500/20">
                      <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Avg Response</span>
                  </div>
                  <p className="text-2xl font-black text-blue-400">142ms</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/50">-12% improvement</p>
                </InternalGlassPanel>
                <InternalGlassPanel density="compact">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-purple-500/20">
                      <Zap className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Throughput</span>
                  </div>
                  <p className="text-2xl font-black text-purple-400">1.2M</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/50">Requests/hour</p>
                </InternalGlassPanel>
                <InternalGlassPanel density="compact">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-orange-500/20">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-white/60">Error Rate</span>
                  </div>
                  <p className="text-2xl font-black text-orange-400">0.02%</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-white/50">Below threshold</p>
                </InternalGlassPanel>
              </div>
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  )
}
