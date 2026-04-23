import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function AutoFixReportPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");

  useEffect(() => {
    const fetchReport = async () => {
      if (!token) {
        setError("Missing report token.");
        setLoading(false);
        return;
      }
      try {
        const response = await api.get("/autofix/report", { params: { token } });
        setData(response.data);
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load auto-fix report.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [token]);

  const submitDecision = async (decision) => {
    setSubmitting(true);
    setDecisionMessage("");
    try {
      const response = await api.post(`/autofix/report/decision?token=${encodeURIComponent(token)}`, {
        decision,
        note: note.trim() || null,
      });
      setDecisionMessage(
        decision === "approve"
          ? response.data.pr_url
            ? `Approved. PR available at ${response.data.pr_url}`
            : "Approved."
          : "Feedback saved."
      );
      const refreshed = await api.get("/autofix/report", { params: { token } });
      setData(refreshed.data);
    } catch (err) {
      setDecisionMessage(err?.response?.data?.detail || "Failed to submit decision.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard-page">
        <div className="empty-state">
          <h2>Auto-fix report unavailable</h2>
          <p>{error || "This report could not be loaded."}</p>
          <Link to="/" className="btn-primary">Home</Link>
        </div>
      </div>
    );
  }

  const execution = data.execution;
  const pipelineRun = data.pipeline_run;
  const report = execution.report || {};
  const risk = pipelineRun.risk || {};
  const diagnosis = pipelineRun.diagnosis || {};
  const isApprovalMode = execution.mode === "approval_pr";
  const branchLabel = report.branch || execution.target_branch || pipelineRun.branch || "n/a";
  const feedbackStatus = (execution.report_feedback_status || "").toLowerCase();
  const isRejected = feedbackStatus === "rejected" || feedbackStatus === "rejected_and_closed" || feedbackStatus === "manual_only";
  const isApproved = feedbackStatus === "approved_create_pr" || feedbackStatus === "approved_and_merged" || feedbackStatus === "approved_future_auto_merge";
  const isDecisionFinalized = isRejected || isApproved;
  const riskLabel =
    typeof report.risk_score === "number"
      ? `${report.risk_score} / 100${report.risk_band ? ` • ${report.risk_band}` : ""}`
      : risk.risk_band || "n/a";

  return (
    <div className="dashboard-page autofix-report-page">
      <section className="workspace-panel">
        <div className="panel-heading">
          <h2>PipelineIQ Auto-fix Review</h2>
          <p>{report.policy_note || "Review the proposed automation outcome below."}</p>
        </div>

        <div className="report-kv-grid">
          <div className="report-kv-card">
            <span>Repository</span>
            <strong>{report.repository || "n/a"}</strong>
          </div>
          <div className="report-kv-card">
            <span>Branch</span>
            <strong>{branchLabel}</strong>
          </div>
          <div className="report-kv-card">
            <span>Mode</span>
            <strong>{execution.mode}</strong>
          </div>
          <div className="report-kv-card">
            <span>Risk</span>
            <strong>{riskLabel}</strong>
          </div>
          <div className="report-kv-card">
            <span>Reviewer</span>
            <strong>{execution.reviewer_username || "n/a"}</strong>
          </div>
        </div>

        {execution.loop_blocked_reason ? (
          <div className="notice-banner warning subtle">
            {execution.loop_blocked_reason}
          </div>
        ) : null}

        <section className="report-section full">
          <h4>Risk</h4>
          <p>{report.risk?.plain_english_summary || risk.plain_english_summary || "No risk summary captured."}</p>
        </section>

        <section className="report-section full">
          <h4>Diagnosis</h4>
          <p>{diagnosis.error_type || "Unknown error"}</p>
          <ul>
            {(diagnosis.possible_causes || []).map((cause, index) => <li key={`cause-${index}`}>{cause}</li>)}
          </ul>
        </section>

        <section className="report-section full">
          <h4>Proposed fix</h4>
          <p>{report.fix_summary || execution.proposed_fix?.summary || "No automatic patch was generated."}</p>
          <ul>
            {(report.possible_fix_steps || []).map((step, index) => <li key={`step-${index}`}>{step}</li>)}
          </ul>
          {execution.pr_url ? (
            <p><a href={execution.pr_url} target="_blank" rel="noreferrer">Open PR</a></p>
          ) : null}
        </section>

        <section className="report-section full">
          <h4>Decision</h4>
          <p>
            {isApprovalMode
              ? "Approve to merge the already-open PR, or reject to close it without merging."
              : "Approve to let PipelineIQ create a PR from this proposed fix, or reject and leave reviewer feedback."}
          </p>
          {execution.report_feedback_status ? (
            <p>Current feedback state: {execution.report_feedback_status.replaceAll("_", " ")}</p>
          ) : null}
          {!isDecisionFinalized ? (
            <>
              <textarea
                className="auth-input"
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional feedback for the agent"
              />
              <div className="workspace-actions" style={{ marginTop: "12px" }}>
                <button className="btn-primary" disabled={submitting} onClick={() => submitDecision("approve")}>
                  {submitting ? "Submitting…" : isApprovalMode ? "Approve And Merge PR" : "Approve And Create PR"}
                </button>
                <button className="btn-secondary" disabled={submitting} onClick={() => submitDecision("reject")}>
                  {submitting ? "Submitting…" : isApprovalMode ? "Reject And Close PR" : "Reject Proposal"}
                </button>
              </div>
            </>
          ) : null}

          {isApproved && execution.pr_url ? (
            <div className="workspace-actions" style={{ marginTop: "12px" }}>
              <a className="btn-primary" href={execution.pr_url} target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginRight: "8px", verticalAlign: "-2px" }}>
                  <path d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.1 3.3 9.43 7.88 10.96.58.1.8-.25.8-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.53-1.35-1.28-1.71-1.28-1.71-1.05-.72.08-.7.08-.7 1.16.08 1.76 1.2 1.76 1.2 1.03 1.78 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.28 1.19-3.08-.12-.3-.52-1.5.11-3.14 0 0 .97-.31 3.18 1.18a10.98 10.98 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.64 1.64.24 2.84.12 3.14.74.8 1.18 1.82 1.18 3.08 0 4.43-2.69 5.4-5.25 5.69.42.37.78 1.08.78 2.19 0 1.58-.01 2.84-.01 3.23 0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.03C23.5 5.66 18.35.5 12 .5z" />
                </svg>
                Open PR to approve
              </a>
            </div>
          ) : null}

          {isRejected ? (
            <p style={{ marginTop: "12px", color: "#dc2626", fontWeight: 600 }}>
              PR is discarded.
            </p>
          ) : null}

          {decisionMessage ? <p style={{ marginTop: "12px" }}>{decisionMessage}</p> : null}
        </section>
      </section>
    </div>
  );
}
