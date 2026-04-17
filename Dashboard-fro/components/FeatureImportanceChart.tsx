'use client';

import React from 'react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface FeatureData {
  name: string;
  importance: number;
  color: string;
}

export const FeatureImportanceChart: React.FC = () => {
  const featureData: FeatureData[] = [
    { name: 'Latency (ms)', importance: 28, color: '#0EA5E9' },
    { name: 'Error Count', importance: 24, color: '#F97316' },
    { name: 'Restart Count', importance: 18, color: '#EF4444' },
    { name: 'Requests/sec', importance: 16, color: '#8B5CF6' },
    { name: 'Memory (MB)', importance: 10, color: '#06B6D4' },
    { name: 'CPU (%)', importance: 4, color: '#10B981' },
  ];

  const chartData = featureData.map(f => ({
    name: f.name.split(' ')[0], // Shorten for chart
    importance: f.importance,
    color: f.color,
    fullName: f.name,
  }));

  return (
    <InternalGlassPanel className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Feature Importance in ML Model</h3>
        <p className="text-sm text-gray-600 dark:text-white/60">Which metrics most influence anomaly detection and classification</p>
      </div>

      {/* Chart */}
      <div className="h-80 -mx-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
              domain={[0, 30]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
              }}
              cursor={{ fill: 'rgba(255,255,255,0.1)' }}
              formatter={(value) => [`${value}%`, 'Importance']}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="importance" radius={[8, 8, 0, 0]} animationDuration={800}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={featureData[index].color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Feature Breakdown */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-3">
        {featureData.map((feature, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: feature.color }}
              />
              <p className="text-xs font-medium text-white truncate">{feature.name}</p>
            </div>
            <p className="text-lg font-bold text-white">{feature.importance}%</p>
          </div>
        ))}
      </div>

      {/* Key Insight */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-white font-medium mb-2">Key Insight</p>
          <p className="text-sm text-white/70">
            Latency and error count are the strongest indicators of system anomalies, accounting for 52% of the model's decision-making. Early detection of latency spikes enables proactive scaling.
          </p>
        </div>
      </div>
    </InternalGlassPanel>
  );
};
