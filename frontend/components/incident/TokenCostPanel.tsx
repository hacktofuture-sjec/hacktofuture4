"use client";
import { useEffect, useState } from "react";
import { CostReport } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

interface Props {
  incidentId: string;
}

export default function TokenCostPanel({ incidentId }: Props) {
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getCostReport(incidentId)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load token cost report", err);
          setReport(null);
          setError("Failed to load token cost report");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <div className="token-cost-panel panel">{error}</div>;
  }

  if (!report) {
    return <div className="token-cost-panel panel">No cost data available.</div>;
  }

  return (
    <section className="token-cost-panel panel">
      <h3 className="section-title">Token Cost</h3>
      <p>Total input tokens: {report.total_input_tokens}</p>
      <p>Total output tokens: {report.total_output_tokens}</p>
      <p>Total AI calls: {report.total_ai_calls}</p>
      <p>Total actual cost (USD): {report.total_actual_cost_usd}</p>
    </section>
  );
}
