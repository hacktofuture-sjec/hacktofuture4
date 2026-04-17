"use client";
import { ExecutorResult } from "@/lib/types";

interface Props {
  execution: ExecutorResult | null;
}

export default function ExecutorPanel({ execution }: Props) {

  if (!execution) {
    return (
      <div className="executor-panel panel-empty">
        <p>Execution is disabled in this demo. Use diagnose and plan to validate the self-healing flow.</p>
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
