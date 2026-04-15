'use client';

import { useEffect, useState } from 'react';
import { AgentAnalyzeResponse, fetchAgentAnalyze } from '@/lib/agent-analyze';

type UseAgentAnalyzeResult = {
  data: AgentAnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

export function useAgentAnalyze(pollIntervalMs = 4000): UseAgentAnalyzeResult {
  const [data, setData] = useState<AgentAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const debugAnalyze = process.env.NEXT_PUBLIC_DEBUG_AGENT_ANALYZE === 'true';

    const load = async () => {
      try {
        const next = await fetchAgentAnalyze();
        if (debugAnalyze) {
          console.debug('[agent/analyze] response', next);
          console.debug('[agent/analyze] ml', next?.ml);
          console.debug('[agent/analyze] mlInsight', next?.mlInsight);
        }
        if (!mounted) return;
        setData(next);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch /agent/analyze');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    const timer = setInterval(load, pollIntervalMs);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return {
    data,
    loading,
    error,
    lastUpdated,
  };
}
