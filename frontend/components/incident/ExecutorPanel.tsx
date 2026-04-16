"use client";
import { useState } from "react";
import { ExecutorResult } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

interface Props {
  execution: ExecutorResult | null;
  incidentId: string;
  onRefresh: () => void;
}

export default function ExecutorPanel({ execution, incidentId, onRefresh }: Props) {
  const [running, setRunning] = useState(false);

  if (!execution) {
    return (
      <div className="executor-panel panel-empty">
        <button
          className="btn-primary"
          onClick={async () => {
            setRunning(true);
            try {
              await api.execute(incidentId);
              onRefresh();
            } catch (error) {
              console.error("Failed to execute plan", error);
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          aria-busy={running}
        >
          {running ? <Spinner /> : "Run Execute"}
        </button>
      </div>
    );
  }

  return (
    <section className="executor-panel panel">
      <h3 className="section-title">Execution</h3>
      <p>
        <strong>Action:</strong> {execution.action}
      </p>
      <p>
        <strong>Status:</strong> {execution.status}
      </p>
      <p>
        <strong>Sandbox validated:</strong> {execution.sandbox_validated ? "Yes" : "No"}
      </p>
      <p>
        <strong>Rollback needed:</strong> {execution.rollback_needed ? "Yes" : "No"}
      </p>
      <p>
        <strong>Timestamp:</strong> {execution.execution_timestamp ?? "N/A"}
      </p>
      {execution.error && (
        <p>
          <strong>Error:</strong> {execution.error}
        </p>
      )}
    </section>
  );
}
