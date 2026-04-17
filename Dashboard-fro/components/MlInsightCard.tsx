'use client';

import React from 'react';
import { Brain, AlertTriangle, CheckCircle, Zap, TrendingUp } from 'lucide-react';

interface MLInsightCardProps {
  available?: boolean;
  anomalyDetected?: boolean;
  confidence?: number;
  predictedIncidentType?: string;
  recommendedAction?: string;
  confidenceLevel?: string;
  executionMode?: string;
  explanation?: string;
  severity?: string;
  isSafeToExecute?: boolean | null;
  loading?: boolean;
  compact?: boolean;
}

export const MLInsightCard: React.FC<MLInsightCardProps> = ({
  available,
  anomalyDetected,
  confidence,
  predictedIncidentType,
  recommendedAction,
  confidenceLevel,
  executionMode,
  explanation,
  severity,
  isSafeToExecute,
  loading = false,
  compact = false,
}) => {
  const hasRealData = available !== false && (
    typeof anomalyDetected === 'boolean' ||
    typeof confidence === 'number' ||
    Boolean(predictedIncidentType) ||
    Boolean(recommendedAction) ||
    Boolean(confidenceLevel) ||
    Boolean(executionMode) ||
    Boolean(explanation) ||
    Boolean(severity) ||
    typeof isSafeToExecute === 'boolean'
  );

  const normalizedConfidence = typeof confidence === 'number'
    ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence))
    : null;
  const confidencePercent = normalizedConfidence === null ? null : Math.round(normalizedConfidence * 100);
  const backendConfidenceLevel = confidenceLevel?.trim();
  const confidenceColor = confidencePercent === null
    ? 'text-white/40'
    : confidencePercent >= 80 ? 'text-green-400' : confidencePercent >= 50 ? 'text-yellow-400' : 'text-red-400';

  const confidenceLabel = confidencePercent === null
    ? backendConfidenceLevel ? `${backendConfidenceLevel.charAt(0).toUpperCase()}${backendConfidenceLevel.slice(1)} Confidence` : 'Unknown Confidence'
    : confidencePercent >= 80
      ? 'High Confidence'
      : confidencePercent >= 50
        ? 'Medium Confidence'
        : 'Low Confidence';

  const severityValue = (severity || (anomalyDetected ? 'critical' : 'healthy')).toLowerCase();
  const severityColor =
    severityValue === 'critical' ? 'bg-red-500/20 border-red-500/50' :
    severityValue === 'warning' ? 'bg-yellow-500/20 border-yellow-500/50' :
    anomalyDetected ? 'bg-yellow-500/20 border-yellow-500/50' :
    'bg-green-500/20 border-green-500/50';

  const severityText =
    severityValue === 'critical' ? 'text-red-400' :
    severityValue === 'warning' ? 'text-yellow-400' :
    anomalyDetected ? 'text-yellow-400' :
    'text-green-400';

  const executionModeText = executionMode || (isSafeToExecute === true ? 'safe' : isSafeToExecute === false ? 'manual' : null);
  const confidenceBarWidth = confidencePercent === null ? 0 : confidencePercent;

  if (loading) {
    return (
      <div className={`rounded-lg border border-white/10 bg-black/30 backdrop-blur-sm p-4 ${compact ? 'min-h-25' : 'min-h-50'} animate-pulse`}>
        <div className="h-4 bg-white/10 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-white/10 rounded w-full"></div>
          <div className="h-3 bg-white/10 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!hasRealData) {
    return (
      <div className={`rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-5 ${compact ? 'min-h-25' : 'min-h-45'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">ML Insight</h3>
        </div>
        <p className="text-sm text-white/60">ML insight unavailable</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`rounded-lg border ${severityColor} bg-black/20 backdrop-blur-sm p-3`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="w-4 h-4 shrink-0 text-blue-400" />
            <div className="min-w-0">
              <p className="text-xs text-white/60">ML Status</p>
              <p className={`text-sm font-medium ${severityText} truncate`}>
                {anomalyDetected ? 'Anomaly Detected' : 'System Normal'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-mono ${confidenceColor}`}>{confidencePercent !== null ? `${confidencePercent}%` : '—'}</p>
            <p className="text-xs text-white/50">{confidenceLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${severityColor} bg-black/20 backdrop-blur-sm p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">ML Insight</h3>
        </div>
        {anomalyDetected ? (
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
        ) : (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      {/* Anomaly Status */}
      <div className="space-y-3">
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Status</p>
          <p className={`text-base font-medium ${severityText}`}>
            {anomalyDetected ? 'Anomaly Detected' : 'No anomaly detected'}
          </p>
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Confidence</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${confidenceColor === 'text-green-400' ? 'bg-green-400' : confidenceColor === 'text-yellow-400' ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${confidenceBarWidth}%` }}
                />
              </div>
            </div>
            <span className={`text-sm font-mono ${confidenceColor}`}>{confidencePercent !== null ? `${confidencePercent}%` : '—'}</span>
          </div>
          <p className="text-xs text-white/50 mt-1">{confidenceLabel}</p>
        </div>

        {/* Predicted Incident Type */}
        {predictedIncidentType && (
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Predicted State</p>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white/80 capitalize">
                {predictedIncidentType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Recommended Action */}
        {recommendedAction && (
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Recommendation</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-white/80 capitalize">
                {recommendedAction.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Safety Status */}
        {typeof isSafeToExecute === 'boolean' && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Execution Safety</p>
            <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium ${isSafeToExecute ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {isSafeToExecute ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {executionModeText ? `Mode: ${executionModeText}` : isSafeToExecute ? 'Safe to Execute' : 'Manual Review Required'}
            </div>
          </div>
        )}

        {explanation && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Explanation</p>
            <p className="text-sm text-white/75 leading-relaxed">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MLInsightCard;
