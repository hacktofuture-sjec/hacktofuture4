'use client';

import React, { useEffect, useState } from 'react';
import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { Brain, ChevronRight, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface Signal {
  name: string;
  icon: React.ReactNode;
  color: string;
  value: string;
}

export const AIExplanationPanel: React.FC = () => {
  const { data } = useAgentAnalyze();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [explanation, setExplanation] = useState<string>('');

  useEffect(() => {
    if (data?.mlInsight) {
      const ml = data.mlInsight;

      // Build explanation
      const parts = [];

      if (ml.anomaly) {
        parts.push(`🔴 Anomaly Detected: ${ml.severity} severity`);
      } else {
        parts.push(`🟢 System operating normally`);
      }

      if (ml.suspectedService) {
        parts.push(`📍 Affected service: ${ml.suspectedService}`);
      }

      if (ml.reason) {
        parts.push(`💡 Root cause: ${ml.reason}`);
      }

      if (ml.recommendedAction) {
        parts.push(`✅ Recommended: ${ml.recommendedAction.replace(/_/g, ' ').toLowerCase()}`);
      }

      setExplanation(parts.join(' • '));

      // Extract signals
      const extractedSignals: Signal[] = [];

      if (ml.anomalyScore) {
        extractedSignals.push({
          name: 'Anomaly Score',
          icon: <TrendingUp className="h-4 w-4" />,
          color: ml.anomalyScore > 0.7 ? 'text-red-400' : ml.anomalyScore > 0.4 ? 'text-yellow-400' : 'text-green-400',
          value: (ml.anomalyScore * 100).toFixed(1) + '%',
        });
      }

      if (ml.confidence) {
        extractedSignals.push({
          name: 'Confidence',
          icon: <Zap className="h-4 w-4" />,
          color: ml.confidence > 0.8 ? 'text-green-400' : 'text-yellow-400',
          value: (ml.confidence * 100).toFixed(1) + '%',
        });
      }

      if (ml.predictedIncidentType) {
        extractedSignals.push({
          name: 'Incident Type',
          icon: <AlertTriangle className="h-4 w-4" />,
          color: 'text-orange-400',
          value: ml.predictedIncidentType.replace(/_/g, ' ').toLowerCase(),
        });
      }

      setSignals(extractedSignals);
    }
  }, [data]);

  const reasoningFactors = [
    { label: 'High CPU Usage', status: 'detected', impact: 'High' },
    { label: 'Increased Latency', status: 'detected', impact: 'High' },
    { label: 'Error Rate Spike', status: 'detected', impact: 'Medium' },
    { label: 'High Memory Consumption', status: 'normal', impact: 'Low' },
  ];

  return (
    <InternalGlassPanel className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          Why did the ML model make this decision?
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/60">AI reasoning and evidence analysis</p>
      </div>

      {/* Main Explanation */}
      {explanation && (
        <div className="bg-gradient-to-r from-purple-500/20 to-indigo-600/20 border border-purple-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-white leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Key Signals */}
      {signals.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-3">Key Signals</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {signals.map((signal, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={signal.color}>{signal.icon}</div>
                  <span className="text-xs font-medium text-white">{signal.name}</span>
                </div>
                <p className={`text-lg font-bold ${signal.color}`}>{signal.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning Factors */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-3">Contributing Factors</p>
        <div className="space-y-2">
          {reasoningFactors.map((factor, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${
                    factor.status === 'detected' ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                  }`}
                />
                <span className="text-sm text-white">{factor.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    factor.impact === 'High'
                      ? 'bg-red-500/20 text-red-400'
                      : factor.impact === 'Medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {factor.impact}
                </span>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ML Model Explanation */}
      <div className="pt-6 border-t border-white/10">
        <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-3">How the ML Model Works</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-400 mb-1">Feature Correlation</p>
            <p className="text-xs text-white/70">ML learns patterns from historical incidents to recognize emerging anomalies before they impact users</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs font-bold text-green-400 mb-1">Preventive Action</p>
            <p className="text-xs text-white/70">Based on detected patterns, the system automatically triggers scaling, restarts, or config updates</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-xs font-bold text-purple-400 mb-1">Confidence Scoring</p>
            <p className="text-xs text-white/70">Higher confidence scores indicate the model is more certain about its prediction and the recommended action</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <p className="text-xs font-bold text-orange-400 mb-1">Continuous Learning</p>
            <p className="text-xs text-white/70">After each incident, the model's accuracy improves through feedback loops and pattern refinement</p>
          </div>
        </div>
      </div>
    </InternalGlassPanel>
  );
};
