"use client";
import { useState, useEffect, useCallback } from "react";
import { IncidentListItem } from "@/lib/types";
import { api } from "@/lib/api";

export function useIncidents() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await api.listIncidents({ limit: 50 });
      setIncidents(res.incidents);
    } catch (error) {
      console.error("Failed to load incidents", error);
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      void reload();
    }, 30_000);
    return () => clearInterval(timer);
  }, [reload]);

  return { incidents, reload };
}
