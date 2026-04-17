'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, LearningMetric } from '@/hooks/useAppStore';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Zap, AlertTriangle, Activity, CheckCircle } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { MLPipelineFlow } from '@/components/MLPipelineFlow';
import { ModelArchitectureDiagram } from '@/components/ModelArchitectureDiagram';
import { FeatureImportanceChart } from '@/components/FeatureImportanceChart';
import { BeforeAfterImpact } from '@/components/BeforeAfterImpact';
import { RealTimeMLOutput } from '@/components/RealTimeMLOutput';
import { AIExplanationPanel } from '@/components/AIExplanationPanel';
import { fetchAllSimulationStates } from '@/lib/simulation-api';

export default function LearningPage() {
  const store = useAppStore();

  // --- NEW STATES FOR ML & SIMULATIONS ---
  const [simulationStates, setSimulationStates] = useState<Record<string, any>>({});
  const [directMlData, setDirectMlData] = useState<any>(null);

  // Initialize learning metrics
  useEffect(() => {
    if (store.learningHistory.length === 0) {
      const mockMetrics: LearningMetric[] = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
        accuracy: 0.7 + Math.random() * 0.25 + i * 0.005,
        precision: 0.75 + Math.random() * 0.2 + i * 0.004,
        falsePositives: Math.max(0, 15 - i * 0.3 + Math.random() * 2),
        mttr: Math.max(5, 45 - i * 0.5 + Math.random() * 10),
        opexSavings: 1000 + i * 100 + Math.random() * 500,
      }));

      mockMetrics.forEach((metric) => store.addLearningMetric(metric));
    }
  }, [store]);

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
          latency: { enabled: mergedRawState.latency },
          error: { enabled: mergedRawState.error },
          crash: { enabled: mergedRawState.crash },
          overload: { enabled: mergedRawState.overload }
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
        // Fallbacks for the demo
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

  // Format data for charts
  const chartData = store.learningHistory.map((m) => ({
    ...m,
    date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accuracy: Math.round(m.accuracy * 100),
    precision: Math.round(m.precision * 100),
    mttr: Math.round(m.mttr),
  }));

  const latestMetric = store.learningHistory[store.learningHistory.length - 1];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Learning & AI Intelligence</h1>
          <p className="text-gray-600 dark:text-white/60 max-w-2xl">
            Comprehensive ML model insights, real-time predictions, and continuous learning optimization. 
            Understand how Nova Chat detects anomalies, classifies incidents, and automatically remediates issues at scale.
          </p>
        </div>

        {/* ML PIPELINE VISUALIZATION */}
        <MLPipelineFlow />

        {/* MODEL ARCHITECTURE */}
        <ModelArchitectureDiagram />

        {/* REAL-TIME ML OUTPUT - PASSING LIVE DATA HERE */}
        <RealTimeMLOutput liveData={directMlData} />

        {/* AI EXPLANATION */}
        <AIExplanationPanel />

        {/* FEATURE IMPORTANCE */}
        <FeatureImportanceChart />

        {/* BEFORE VS AFTER IMPACT */}
        <BeforeAfterImpact />

        {/* INTELLIGENCE METRICS & TRENDS */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Intelligence Growth Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlowCard glowColor="green" customSize={true} className="w-full h-auto min-h-[120px]">
              <p className="text-sm text-gray-600 dark:text-white/60 mb-1">Model Accuracy</p>
              <p className="text-3xl font-bold text-green-400">
                {latestMetric ? Math.round(latestMetric.accuracy * 100) : 0}%
              </p>
              <p className="text-xs text-green-400 mt-2">+2.3% from baseline</p>
            </GlowCard>

            <GlowCard glowColor="blue" customSize={true} className="w-full h-auto min-h-[120px]">
              <p className="text-sm text-gray-600 dark:text-white/60 mb-1">Precision Score</p>
              <p className="text-3xl font-bold text-blue-400">
                {latestMetric ? Math.round(latestMetric.precision * 100) : 0}%
              </p>
              <p className="text-xs text-blue-400 mt-2">+1.8% from baseline</p>
            </GlowCard>

            <GlowCard glowColor="orange" customSize={true} className="w-full h-auto min-h-[120px]">
              <p className="text-sm text-gray-600 dark:text-white/60 mb-1">False Positives</p>
              <p className="text-3xl font-bold text-orange-400">
                {latestMetric ? latestMetric.falsePositives.toFixed(0) : 0}
              </p>
              <p className="text-xs text-orange-400 mt-2">-15% from baseline</p>
            </GlowCard>

            <GlowCard glowColor="purple" customSize={true} className="w-full h-auto min-h-[120px]">
              <p className="text-sm text-gray-600 dark:text-white/60 mb-1">Est. OpEx Savings</p>
              <p className="text-3xl font-bold text-purple-400">
                ${latestMetric ? (latestMetric.opexSavings / 1000).toFixed(1) : 0}K
              </p>
              <p className="text-xs text-purple-400 mt-2">+$12.4K this month</p>
            </GlowCard>
          </div>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Model Accuracy Trend */}
          <GlowCard glowColor="blue" customSize={true} className="p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Model Accuracy Trend</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.45)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    name="Accuracy"
                    strokeWidth={3}
                    activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="precision"
                    stroke="#2563eb"
                    name="Precision"
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </GlowCard>

          {/* MTTR Improvement */}
          <GlowCard glowColor="purple" customSize={true} className="p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mean Time to Recover (MTTR)</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.45)" />
                  <YAxis stroke="rgba(255,255,255,0.45)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Legend />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e40af" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <Bar dataKey="mttr" fill="url(#blueGradient)" name="MTTR (minutes)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </GlowCard>
        </div>

        {/* System Optimization & Learning */}
        <InternalGlassPanel className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Optimization Insights</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InternalGlassPanel density="compact" className="border-primary/20 bg-black/20">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Database Optimization</p>
              <p className="text-sm text-gray-800 dark:text-white/90">
                Increase connection pool by 50% to prevent peak hour spikes. Historical patterns show this will reduce latency by 23%.
              </p>
              <button type="button" className="mt-3 text-xs font-semibold text-primary hover:underline">
                Apply Recommendation &#8594;
              </button>
            </InternalGlassPanel>

            <InternalGlassPanel density="compact" className="border-accent/20 bg-black/20">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Service Mesh Tuning</p>
              <p className="text-sm text-gray-800 dark:text-white/90">
                Tune Service Mesh timeout to 200ms based on observed request patterns. Will reduce cascading failures by 31%.
              </p>
              <button type="button" className="mt-3 text-xs font-semibold text-accent hover:underline">
                Apply Recommendation &#8594;
              </button>
            </InternalGlassPanel>

            <InternalGlassPanel density="compact" className="border-yellow-500/20 bg-black/20">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Cache Strategy</p>
              <p className="text-sm text-gray-800 dark:text-white/90">
                Implement distributed caching for frequently accessed data. Projected throughput improvement: 45%.
              </p>
              <button type="button" className="mt-3 text-xs font-semibold text-yellow-500 hover:underline">
                Apply Recommendation &#8594;
              </button>
            </InternalGlassPanel>

            <InternalGlassPanel density="compact" className="border-green-500/20 bg-black/20">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Auto-Scaling Policy</p>
              <p className="text-sm text-gray-800 dark:text-white/90">
                Update auto-scaling thresholds to 60% CPU utilization. Will improve response time during peak loads by 28%.
              </p>
              <button type="button" className="mt-3 text-xs font-semibold text-green-500 hover:underline">
                Apply Recommendation &#8594;
              </button>
            </InternalGlassPanel>
          </div>
        </InternalGlassPanel>

        {/* AI Feedback Loop */}
        <InternalGlassPanel className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Feedback Loop Chronicle</h2>
          </div>
          <div className="max-h-48 space-y-3 overflow-y-auto">
            {[
              { action: 'Model retrained with new anomaly patterns', time: '2 hours ago' },
              { action: 'Auto-scaling policy updated based on usage', time: '5 hours ago' },
              { action: 'Cache warming strategy implemented', time: '8 hours ago' },
              { action: 'Database connection pool optimized', time: '12 hours ago' },
            ].map((item, idx) => (
              <InternalGlassPanel key={idx} density="compact">
                <div className="flex gap-3">
                  <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{item.action}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">{item.time}</p>
                  </div>
                </div>
              </InternalGlassPanel>
            ))}
          </div>
        </InternalGlassPanel>
      </div>
    </div>
  );
}