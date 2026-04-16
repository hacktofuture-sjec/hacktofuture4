"use client";
import { useState } from "react";
import { PlannerOutput } from "@/lib/types";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import ApprovalModal from "@/components/controls/ApprovalModal";
import Spinner from "@/components/ui/Spinner";

interface Props {
  plan: PlannerOutput | null;
  incidentId: string;
  onRefresh: () => void;
}

export default function PlannerPanel({ plan, incidentId, onRefresh }: Props) {
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState<number | null>(null);

  if (!plan) {
    return (
      <div className="panel-empty">
        <button
          id="run-plan-btn"
          className="btn-primary"
          onClick={async () => {
            setRunning(true);
            try {
              await api.plan(incidentId);
              onRefresh();
            } catch (error) {
              console.error("Failed to generate plan", error);
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          aria-busy={running}
        >
          {running ? <Spinner /> : "Generate Plan"}
        </button>
      </div>
    );
  }

  return (
    <div className="planner-panel">
      <h3 className="section-title">Remediation Plan</h3>
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
            >
              {action.approval_required ? "Review & Approve" : "Execute"}
            </button>
          </li>
        ))}
      </ol>

      {approving !== null && (
        <ApprovalModal
          action={plan.actions[approving]}
          actionIndex={approving}
          incidentId={incidentId}
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
