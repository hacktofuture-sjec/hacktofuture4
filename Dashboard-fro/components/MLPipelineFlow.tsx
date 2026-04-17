'use client';

import React, { useState } from 'react';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { 
  Database, 
  Zap, 
  Brain, 
  BarChart3, 
  TrendingUp, 
  Settings, 
  Wrench, 
  CheckCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  details: string[];
}

export const MLPipelineFlow: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  const stages: PipelineStage[] = [
    {
      id: '1',
      name: 'Telemetry Collection',
      description: 'Real-time metrics gathering',
      icon: <Database className="h-5 w-5" />,
      color: 'from-blue-500/30 to-blue-600/20',
      details: ['CPU usage', 'Memory allocation', 'Latency measurements'],
    },
    {
      id: '2',
      name: 'Feature Extraction',
      description: 'Transform raw metrics',
      icon: <Zap className="h-5 w-5" />,
      color: 'from-cyan-500/30 to-cyan-600/20',
      details: ['Trend analysis', 'Normalization', 'Aggregation'],
    },
    {
      id: '3',
      name: 'ML Inference',
      description: 'Run trained models',
      icon: <Brain className="h-5 w-5" />,
      color: 'from-purple-500/30 to-purple-600/20',
      details: ['Anomaly detection', 'Classification', 'Scoring'],
    },
    {
      id: '4',
      name: 'Failure Classification',
      description: 'Identify issue type',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'from-orange-500/30 to-orange-600/20',
      details: ['Overload', 'Crash loop', 'Latency issue'],
    },
    {
      id: '5',
      name: 'Confidence Scoring',
      description: 'Assess prediction quality',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'from-green-500/30 to-green-600/20',
      details: ['Confidence %', 'Evidence weighting'],
    },
    {
      id: '6',
      name: 'Decision Engine',
      description: 'Determine action',
      icon: <Settings className="h-5 w-5" />,
      color: 'from-indigo-500/30 to-indigo-600/20',
      details: ['Action mapping', 'Priority calculation'],
    },
    {
      id: '7',
      name: 'Remediation',
      description: 'Execute healing',
      icon: <Wrench className="h-5 w-5" />,
      color: 'from-pink-500/30 to-pink-600/20',
      details: ['Scale pods', 'Restart services'],
    },
    {
      id: '8',
      name: 'Kubernetes Execution',
      description: 'Deploy at scale',
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'from-teal-500/30 to-teal-600/20',
      details: ['Deploy', 'Monitor', 'Verify'],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Simple View */}
      <InternalGlassPanel className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">ML Pipeline Flow</h3>
            <p className="text-sm text-gray-600 dark:text-white/60">Automated anomaly detection and remediation journey</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium text-gray-600 dark:text-white/70"
          >
            {expanded ? 'Simple View' : 'Advanced View'}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Pipeline Flow */}
        <div className="space-y-3">
          {(expanded ? stages : stages.slice(0, 5)).map((stage, idx) => (
            <div key={stage.id}>
              <div className={`bg-linear-to-r ${stage.color} border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors group cursor-help`} title={stage.details.join(', ')}>
                <div className="flex items-center gap-3">
                  <div className="text-white/70 group-hover:text-white transition-colors">
                    {stage.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{stage.name}</p>
                    <p className="text-xs text-white/60">{stage.description}</p>
                  </div>
                  <div className="text-xs font-mono text-white/50">Step {stage.id}/8</div>
                </div>
              </div>

              {/* Arrow */}
              {idx < (expanded ? stages.length - 1 : 4) && (
                <div className="flex justify-center py-2">
                  <div className="w-0.5 h-8 bg-linear-to-b from-blue-500/50 to-transparent animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>

        {expanded && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-600 dark:text-white/60 mb-4">Advanced Pipeline Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stages.map(stage => (
                <div key={stage.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="font-medium text-sm text-white mb-2">{stage.name}</p>
                  <ul className="text-xs text-white/60 space-y-1">
                    {stage.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </InternalGlassPanel>
    </div>
  );
};
