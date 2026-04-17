'use client';

import React from 'react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { ArrowRight, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';

interface ComparisonMetric {
  label: string;
  before: string | number;
  after: string | number;
  improvement: string;
  icon: React.ReactNode;
  color: string;
}

export const BeforeAfterImpact: React.FC = () => {
  const metrics: ComparisonMetric[] = [
    {
      label: 'Running Pods',
      before: 1,
      after: 3,
      improvement: '+200%',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'from-green-500/30 to-green-600/20',
    },
    {
      label: 'System Status',
      before: '🔴 Critical',
      after: '🟢 Healthy',
      improvement: 'Fixed',
      icon: <TrendingDown className="h-5 w-5" />,
      color: 'from-blue-500/30 to-blue-600/20',
    },
    {
      label: 'Latency (ms)',
      before: 3500,
      after: 125,
      improvement: '-96.4%',
      icon: <TrendingDown className="h-5 w-5" />,
      color: 'from-cyan-500/30 to-cyan-600/20',
    },
    {
      label: 'Error Rate',
      before: '18.2%',
      after: '0.02%',
      improvement: '-99.9%',
      icon: <TrendingDown className="h-5 w-5" />,
      color: 'from-orange-500/30 to-orange-600/20',
    },
    {
      label: 'Uptime',
      before: '45%',
      after: '99.8%',
      improvement: '+122%',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'from-purple-500/30 to-purple-600/20',
    },
    {
      label: 'Response Time',
      before: '2.8s',
      after: '142ms',
      improvement: '-95%',
      icon: <TrendingDown className="h-5 w-5" />,
      color: 'from-indigo-500/30 to-indigo-600/20',
    },
  ];

  return (
    <InternalGlassPanel className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Before vs After Impact</h3>
        <p className="text-sm text-gray-600 dark:text-white/60">System state transformation after ML-driven remediation</p>
      </div>

      {/* Comparison Grid */}
      <div className="space-y-3">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`bg-gradient-to-r ${metric.color} border border-white/10 rounded-lg p-4`}>
            <div className="flex items-center justify-between gap-4">
              {/* Before Section */}
              <div className="flex-1 text-center">
                <p className="text-xs text-white/60 mb-1">BEFORE</p>
                <p className="text-lg font-bold text-white">{metric.before}</p>
              </div>

              {/* Arrow & Icon */}
              <div className="flex flex-col items-center gap-2">
                <ArrowRight className="h-5 w-5 text-white/40 animate-bounce-x" />
                <div className="text-white/60">
                  {metric.icon}
                </div>
              </div>

              {/* After Section */}
              <div className="flex-1 text-center">
                <p className="text-xs text-white/60 mb-1">AFTER</p>
                <p className="text-lg font-bold text-green-400">{metric.after}</p>
              </div>

              {/* Improvement Badge */}
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                <div className="text-right">
                  <p className="text-xs text-white/60">{metric.label}</p>
                  <p className="text-sm font-bold text-white">{metric.improvement}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <p className="font-semibold text-white text-sm">Overall Impact</p>
          </div>
          <p className="text-xs text-white/70">System recovered from critical state to healthy in ~8 minutes via ML-driven auto-healing</p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-blue-400" />
            <p className="font-semibold text-white text-sm">Response Time</p>
          </div>
          <p className="text-xs text-white/70">Latency reduced by 96% through intelligent resource allocation and horizontal scaling</p>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-purple-400" />
            <p className="font-semibold text-white text-sm">Efficiency Gain</p>
          </div>
          <p className="text-xs text-white/70">99.98% of anomalies were automatically resolved without manual intervention</p>
        </div>
      </div>
    </InternalGlassPanel>
  );
};
