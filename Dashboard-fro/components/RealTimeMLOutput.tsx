'use client';

import React, { useEffect, useState } from 'react';
import { useAgentAnalyze } from '@/hooks/useAgentAnalyze';
import { InternalGlassPanel } from '@/components/ui/gradient-background-4';
import { Activity, Clock, AlertTriangle, CheckCircle, Zap, RefreshCw } from 'lucide-react';

interface MLPrediction {
  anomalyDetected: boolean;
  suspectedService: string;
  confidence: number;
  severity: string;
  recommendedAction: string;
  executionMode: string;
  timestamp: string;
}

interface RealTimeMLOutputProps {
  liveData?: unknown;
}

export const RealTimeMLOutput: React.FC<RealTimeMLOutputProps> = ({ liveData }) => {
  const { data, loading, error } = useAgentAnalyze(3000); // Auto-refresh every 3 seconds
  const [mlData, setMlData] = useState<MLPrediction | null>(null);
  const [refreshTime, setRefreshTime] = useState<Date>(new Date());

  useEffect(() => {
    const source = (liveData as any) || data?.mlInsight;
    if (source) {
      setMlData({
        anomalyDetected: source.anomaly || source.anomalyDetected || false,
        suspectedService: source.suspectedService || 'Unknown',
        confidence: Math.round((source.confidence || 0) * 100),
        severity: source.severity || 'Unknown',
        recommendedAction:
          source.recommendedAction?.replace(/_/g, ' ') || 'No Action',
        executionMode: source.isSafeToExecute ? 'AUTO-HEAL' : 'REVIEW',
        timestamp: new Date().toLocaleTimeString(),
      });
      setRefreshTime(new Date());
    }
  }, [data, liveData]);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'from-red-500/30 to-red-600/20';
      case 'high':
        return 'from-orange-500/30 to-orange-600/20';
      case 'medium':
        return 'from-yellow-500/30 to-yellow-600/20';
      default:
        return 'from-green-500/30 to-green-600/20';
    }
  };

  const getExecutionModeColor = (mode: string) => {
    return mode === 'AUTO-HEAL'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  };

  if (error) {
    return (
      <InternalGlassPanel className="p-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">Unable to fetch ML predictions: {error}</p>
        </div>
      </InternalGlassPanel>
    );
  }

  return (
    <InternalGlassPanel className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Real-Time ML Output
          </h3>
          <p className="text-sm text-gray-600 dark:text-white/60">Live prediction from ML pipeline</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
          <span>Last updated: {refreshTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {mlData ? (
        <div className="space-y-4">
          {/* Anomaly Status */}
          <div className={`bg-linear-to-r ${getSeverityColor(mlData.severity)} border border-white/10 rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mlData.anomalyDetected ? (
                  <AlertTriangle className="h-6 w-6 text-orange-400 animate-pulse" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                )}
                <div>
                  <p className="text-sm text-white/70">Anomaly Detected</p>
                  <p className="text-lg font-bold text-white">
                    {mlData.anomalyDetected ? 'YES' : 'NO'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/70 mb-1">Severity</p>
                <p className="text-lg font-bold text-white capitalize">{mlData.severity}</p>
              </div>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="bg-linear-to-r from-blue-500/30 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">ML Confidence Score</p>
              <p className="text-2xl font-bold text-blue-400">{mlData.confidence}%</p>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${mlData.confidence}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-white/60">
              <span>Low Confidence</span>
              <span>High Confidence</span>
            </div>
          </div>

          {/* Service & Classification */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-white/60 mb-2">Suspected Service</p>
              <p className="text-sm font-bold text-white truncate">{mlData.suspectedService}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-xs text-white/60 mb-2">Classification</p>
              <p className="text-sm font-bold text-white capitalize">{mlData.severity}</p>
            </div>
          </div>

          {/* Recommended Action */}
          <div className="bg-linear-to-r from-purple-500/30 to-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-xs text-white/70 mb-2">Recommended Action</p>
            <p className="text-base font-bold text-white capitalize mb-3">{mlData.recommendedAction}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getExecutionModeColor(mlData.executionMode)}`}>
                {mlData.executionMode}
              </span>
              <span className="text-xs text-white/60 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Safe to Execute
              </span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/10 text-xs text-white/50">
            <Clock className="h-4 w-4" />
            <span>Prediction generated at {mlData.timestamp}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-white/60">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span>Loading ML predictions...</span>
        </div>
      )}
    </InternalGlassPanel>
  );
};
