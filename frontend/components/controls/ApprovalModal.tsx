"use client";
import { useState } from "react";
import { PlannerAction } from "@/lib/types";
import { api } from "@/lib/api";
import Spinner from "@/components/ui/Spinner";

interface Props {
  action: PlannerAction;
  actionIndex: number;
  incidentId: string;
  onClose: () => void;
  onDone: () => void;
}

export default function ApprovalModal({
  action,
  actionIndex,
  incidentId,
  onClose,
  onDone,
}: Props) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (approved: boolean) => {
    setLoading(true);
    try {
      await api.approve(incidentId, actionIndex, approved, note);
      onDone();
    } catch (error) {
      console.error("Failed to submit approval", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div className="modal">
        <h3 id="approval-modal-title" className="modal-title">
          {action.risk_level === "high"
            ? "⚠ High-Risk Action — Approval Required"
            : "Execute Action"}
        </h3>

        <div className="modal-section">
          <label className="modal-label">Command</label>
          <code className="modal-command">{action.action}</code>
        </div>

        <div className="modal-section">
          <label className="modal-label">Expected Outcome</label>
          <p>{action.expected_outcome}</p>
        </div>

        <div className="modal-section">
          <label className="modal-label">Simulation</label>
          <ul className="sim-list">
            <li>Blast radius: {Math.round(action.simulation_result.blast_radius_score * 100)}%</li>
            <li>Rollback ready: {action.simulation_result.rollback_ready ? "Yes" : "No"}</li>
            <li>Dependency impact: {action.simulation_result.dependency_impact}</li>
            {action.simulation_result.policy_violations.length > 0 && (
              <li className="violation">
                Violations: {action.simulation_result.policy_violations.join(", ")}
              </li>
            )}
          </ul>
        </div>

        <div className="modal-section">
          <label className="modal-label" htmlFor="approval-note">
            Note (optional)
          </label>
          <textarea
            id="approval-note"
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for approval..."
            rows={2}
          />
        </div>

        <div className="modal-actions">
          <button
            id="reject-action-btn"
            className="btn-danger"
            onClick={() => submit(false)}
            disabled={loading}
          >
            Reject
          </button>
          <button
            id="confirm-action-btn"
            className="btn-primary"
            onClick={() => submit(true)}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? <Spinner /> : "Approve & Execute"}
          </button>
          <button id="cancel-modal-btn" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
