"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Incident } from "@/lib/types";

export function useIncidents(pollInterval = 5000) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await api.listIncidents();
      setIncidents(data.incidents as Incident[]);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, pollInterval);
    return () => clearInterval(timer);
  }, [fetchIncidents, pollInterval]);

  return { incidents, loading, error, refetch: fetchIncidents };
}
