'use client';

import React from 'react';
import { AlertTriangle, CheckCircle, Zap, BarChart3 } from 'lucide-react';

interface MLEvidenceProps {
  available?: boolean;
  contributingSignals?: string[];
  contributingFactors?: string[];
  classProbs?: Record<string, number>;
  anomalyScore?: number;
  compact?: boolean;
}

export const MLEvidence: React.FC<MLEvidenceProps> = ({
  available = true,
  contributingSignals = [],
  contributingFactors = [],
  classProbs = {},
  anomalyScore,
  compact = false,
}) => {
  const sortedProbs = Object.entries(classProbs || {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  const hasContent = contributingSignals.length > 0 || contributingFactors.length > 0 || sortedProbs.length > 0 || typeof anomalyScore === 'number';

  if (!available || !hasContent) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm p-4 text-sm text-white/60">
        ML insight unavailable
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {contributingSignals.length > 0 && (
          <div>
            <p className="text-xs text-white/60 mb-1">Active Signals</p>
            <div className="flex flex-wrap gap-1">
              {contributingSignals.slice(0, 3).map((signal) => (
                <span key={signal} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                  <Zap className="w-3 h-3" />
                  {signal.replace(/_/g, ' ')}
                </span>
              ))}
              {contributingSignals.length > 3 && (
                <span className="text-xs text-white/50">+{contributingSignals.length - 3} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Anomaly Score */}
      {typeof anomalyScore === 'number' && (
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Anomaly Score</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, (anomalyScore + 1) * 50))}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-mono text-white/80">{anomalyScore.toFixed(3)}</span>
          </div>
        </div>
      )}

      {/* Contributing Signals */}
      {contributingSignals.length > 0 && (
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Contributing Signals</p>
          <div className="flex flex-wrap gap-2">
            {contributingSignals.map((signal) => (
              <div
                key={signal}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
              >
                <Zap className="w-3 h-3" />
                {signal.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contributing Factors */}
      {contributingFactors.length > 0 && (
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Contributing Factors</p>
          <ul className="space-y-1">
            {contributingFactors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Class Probabilities */}
      {sortedProbs.length > 0 && (
        <div>
          <p className="text-xs text-white/60 uppercase tracking-wide mb-2 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Failure Type Probabilities
          </p>
          <div className="space-y-2">
            {sortedProbs.map(([className, prob]) => (
              <div key={className}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/70 capitalize">{className.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-white/50">{((prob as number) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(prob as number) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MLEvidence;
