"use client";
import { useEffect, useRef, useState } from "react";
import { PlannerOutput } from "@/lib/types";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import ApprovalModal from "@/components/controls/ApprovalModal";
import Spinner from "@/components/ui/Spinner";

interface Props {
  plan: PlannerOutput | null;
  incidentId: string;
  incidentStatus: string;
  plannedAt?: string | null;
  replanAttempts?: number;
  updatedAt?: string;
  onRefresh: () => void;
}

const AUTO_EXECUTE_CONFIDENCE_MAX = 0.6;

export default function PlannerPanel({
  plan,
  incidentId,
  incidentStatus,
  plannedAt,
  replanAttempts,
  updatedAt,
  onRefresh,
}: Props) {
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const canReviewActions = incidentStatus === "planned" || incidentStatus === "pending_approval";
  const autoPlanRequestedRef = useRef<string | null>(null);
  const autoExecutedRef = useRef<string | null>(null);

  useEffect(() => {
    if (plan) {
      return;
    }

    if (running) {
      return;
    }

    if (autoPlanRequestedRef.current === incidentId) {
      return;
    }

    autoPlanRequestedRef.current = incidentId;
    setRunning(true);
    void api
      .plan(incidentId)
      .then(() => {
        setAutoMessage("Plan generated automatically after diagnosis.");
        return onRefresh();
      })
      .catch((error) => {
        console.error("Failed to auto-generate plan", error);
        setAutoMessage("Failed to auto-generate plan.");
      })
      .finally(() => {
        setRunning(false);
      });
  }, [incidentId, onRefresh, plan, running]);

  useEffect(() => {
    if (!plan || plan.actions.length === 0) {
      return;
    }

    if (incidentStatus !== "planned") {
      return;
    }

    const action = plan.actions[0];
    const risk = String(action.risk_level).toLowerCase();
    const requiresHuman = risk === "medium" || risk === "high" || risk === "critical";
    if (requiresHuman) {
      return;
    }

    const confidence = Number(action.confidence ?? 1);
    if (!Number.isFinite(confidence) || confidence > AUTO_EXECUTE_CONFIDENCE_MAX) {
      return;
    }

    const executionKey = `${incidentId}:${plannedAt ?? ""}:${action.action}`;
    if (autoExecutedRef.current === executionKey) {
      return;
    }
    autoExecutedRef.current = executionKey;

    setAutoMessage("Low-confidence low-risk plan detected. Auto-executing action.");
    setRunning(true);
    void api
      .approve(incidentId, 0, true, "auto-approved: low-confidence low-risk plan")
      .then(() => api.execute(incidentId, 0))
      .then(() => onRefresh())
      .catch((error) => {
        console.error("Failed to auto-execute low-confidence action", error);
        setAutoMessage("Auto-execution failed. Please review action manually.");
      })
      .finally(() => {
        setRunning(false);
      });
  }, [incidentId, incidentStatus, onRefresh, plan, plannedAt]);

  if (!plan) {
    return (
      <div className="panel-empty">
        <p>{running ? "Generating plan automatically..." : "Waiting for automatic plan generation..."}</p>
        {running && <Spinner />}
        {autoMessage && <p>{autoMessage}</p>}
      </div>
    );
  }

  return (
    <div className="planner-panel">
      <h3 className="section-title">Remediation Plan</h3>
      <div className="planner-state-row">
        <span className="planner-state-badge">Status: {incidentStatus}</span>
        {typeof replanAttempts === "number" && replanAttempts > 0 && (
          <span className="planner-state-badge">Replan attempts: {replanAttempts}</span>
        )}
        {plannedAt && <span className="planner-state-meta">Planned at: {plannedAt}</span>}
        {updatedAt && <span className="planner-state-meta">Updated at: {updatedAt}</span>}
      </div>
      {autoMessage && <p>{autoMessage}</p>}
      {actionMessage && <p className="planner-feedback">{actionMessage}</p>}
      <ol className="action-list">
        {plan.actions.map((action, idx) => (
          <li key={idx} className="action-item">
            <div className="action-header">
              <code className="action-command">{action.action}</code>
              <Badge variant={action.risk_level}>{action.risk_level} risk</Badge>
            </div>
            <p className="action-description">{action.description}</p>
            <p className="action-outcome">{action.expected_outcome}</p>
            <ProgressBar value={action.confidence} label="Confidence" />
            <div className="action-meta">
              <span>
                Blast radius: {Math.round(action.simulation_result.blast_radius_score * 100)}%
              </span>
              <span>Rollback ready: {action.simulation_result.rollback_ready ? "✓" : "✗"}</span>
              <span>Impact: {action.simulation_result.dependency_impact}</span>
            </div>
            <button
              id={`approve-action-${idx}-btn`}
              className={`btn-approve ${action.risk_level === "high" ? "btn-danger" : "btn-primary"}`}
              onClick={() => setApproving(idx)}
              hidden={!canReviewActions}
            >
              {action.approval_required ? "Review / Approve / Reject" : "Run Action"}
            </button>
            {!canReviewActions && (
              <p className="planner-state-meta">
                Plan locked while incident is in <strong>{incidentStatus}</strong> state.
              </p>
            )}
          </li>
        ))}
      </ol>

      {approving !== null && (
        <ApprovalModal
          action={plan.actions[approving]}
          actionIndex={approving}
          incidentId={incidentId}
          onClose={() => setApproving(null)}
          onDone={(result) => {
            setActionMessage(result.message);
            setApproving(null);
            void onRefresh();
          }}
        />
      )}
    </div>
  );
}
