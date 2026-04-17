'use client';

import React from 'react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import {
  Database,
  Network,
  Boxes,
  TrendingUp,
  Zap,
  GitBranch,
} from 'lucide-react';

export const ModelArchitectureDiagram: React.FC = () => {
  return (
    <InternalGlassPanel className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Model Architecture</h3>
        <p className="text-sm text-gray-600 dark:text-white/60">ML pipeline system design and data flow</p>
      </div>

      {/* Architecture Diagram */}
      <div className="space-y-6">
        {/* Input Layer */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">Input Layer</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3 text-center">
              <Database className="h-5 w-5 mx-auto mb-2 text-blue-400" />
              <p className="text-sm font-medium text-white">Telemetry</p>
              <p className="text-xs text-white/60 mt-1">Metrics & Events</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-3 text-center">
              <Network className="h-5 w-5 mx-auto mb-2 text-cyan-400" />
              <p className="text-sm font-medium text-white">Kubernetes</p>
              <p className="text-xs text-white/60 mt-1">Pod & Deployment</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-3 text-center">
              <Zap className="h-5 w-5 mx-auto mb-2 text-purple-400" />
              <p className="text-sm font-medium text-white">Features</p>
              <p className="text-xs text-white/60 mt-1">Engineered Signals</p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-4 border-l border-blue-400/50 border-b border-t-0 border-r-0 w-12 relative">
            <div className="absolute -right-1 -bottom-1 w-2 h-2 border-t border-r border-blue-400/50 transform rotate-45" />
          </div>
        </div>

        {/* ML Adapter */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">ML Adapter</p>
          <div className="bg-gradient-to-r from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 rounded-lg p-4">
            <div className="flex items-center justify-center gap-3">
              <div className="text-indigo-400">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Node.js Bridge</p>
                <p className="text-xs text-white/60">Telemetry Window Aggregation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-4 border-l border-indigo-400/50 border-b border-t-0 border-r-0 w-12 relative">
            <div className="absolute -right-1 -bottom-1 w-2 h-2 border-t border-r border-indigo-400/50 transform rotate-45" />
          </div>
        </div>

        {/* Models */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">Trained Models</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3 text-center">
              <Boxes className="h-5 w-5 mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium text-white">Classifier</p>
              <p className="text-xs text-white/60 mt-1">RandomForest</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-orange-400" />
              <p className="text-sm font-medium text-white">Anomaly</p>
              <p className="text-xs text-white/60 mt-1">IsolationForest</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/30 rounded-lg p-3 text-center">
              <Database className="h-5 w-5 mx-auto mb-2 text-pink-400" />
              <p className="text-sm font-medium text-white">Encoder</p>
              <p className="text-xs text-white/60 mt-1">Label Mapping</p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-4 border-l border-green-400/50 border-b border-t-0 border-r-0 w-12 relative">
            <div className="absolute -right-1 -bottom-1 w-2 h-2 border-t border-r border-green-400/50 transform rotate-45" />
          </div>
        </div>

        {/* Output Layer */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">Output Layer</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3 text-center">
              <p className="text-sm font-mono text-blue-400">Anomaly</p>
              <p className="text-xs text-white/60 mt-1">Boolean</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-3 text-center">
              <p className="text-sm font-mono text-cyan-400">Class</p>
              <p className="text-xs text-white/60 mt-1">Issue Type</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-3 text-center">
              <p className="text-sm font-mono text-purple-400">Score</p>
              <p className="text-xs text-white/60 mt-1 ">0.0 - 1.0</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3 text-center">
              <p className="text-sm font-mono text-green-400">Action</p>
              <p className="text-xs text-white/60 mt-1">Remediation</p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="h-4 border-l border-blue-400/50 border-b border-t-0 border-r-0 w-12 relative">
            <div className="absolute -right-1 -bottom-1 w-2 h-2 border-t border-r border-blue-400/50 transform rotate-45" />
          </div>
        </div>

        {/* Decision Engine */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">Decision Engine</p>
          <div className="bg-gradient-to-r from-teal-500/20 to-teal-600/10 border border-teal-500/30 rounded-lg p-4">
            <div className="flex items-center justify-center gap-3">
              <div className="text-teal-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Kubernetes Execution</p>
                <p className="text-xs text-white/60">Scale, Restart, Update, Monitor</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Input Features</p>
          <p className="text-2xl font-bold text-white">11</p>
          <p className="text-xs text-white/60">Engineered metrics</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Model Accuracy</p>
          <p className="text-2xl font-bold text-green-400">93%</p>
          <p className="text-xs text-white/60">On validation set</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-white/60 mb-1">Inference Time</p>
          <p className="text-2xl font-bold text-blue-400">~250ms</p>
          <p className="text-xs text-white/60">Per prediction</p>
        </div>
      </div>
    </InternalGlassPanel>
  );
};
