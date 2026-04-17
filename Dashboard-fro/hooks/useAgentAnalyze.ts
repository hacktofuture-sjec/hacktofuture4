'use client';

import { useEffect, useState } from 'react';
import { AgentAnalyzeResponse, fetchAgentAnalyze } from '@/lib/agent-analyze';

type UseAgentAnalyzeResult = {
  data: AgentAnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

export function useAgentAnalyze(pollIntervalMs = 3000): UseAgentAnalyzeResult {
  const [data, setData] = useState<AgentAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const debugAnalyze = process.env.NEXT_PUBLIC_DEBUG_AGENT_ANALYZE === 'true';
    const debugPolling = process.env.NEXT_PUBLIC_DEBUG_POLLING === 'true';

    const load = async () => {
      try {
        const next = await fetchAgentAnalyze();
        if (!mounted) return;
        
        setData(next);
        setError(null);
        const now = new Date();
        setLastUpdated(now);
        
        if (debugAnalyze) {
          console.debug('[agent/analyze] ✓ Fresh data at', now.toLocaleTimeString());
          console.debug('[agent/analyze] services:', next?.monitoring?.services);
          console.debug('[agent/analyze] system status:', next?.monitoring?.overall);
          console.debug('[agent/analyze] ml:', next?.ml);
          console.debug('[agent/analyze] mlInsight:', next?.mlInsight);
        }
        if (debugPolling) {
          console.log('[polling] Updated /agent/analyze at', now.toLocaleTimeString());
        }
      } catch (err) {
        if (!mounted) return;
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch /agent/analyze';
        setError(errorMsg);
        if (debugAnalyze || debugPolling) {
          console.error('[agent/analyze] ✗ Error:', errorMsg);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial load
    load();
    
    // Set up polling interval (2.5 seconds = 2500ms for faster updates)
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
