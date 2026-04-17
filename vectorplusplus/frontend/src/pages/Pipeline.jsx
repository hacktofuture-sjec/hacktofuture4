import { useState } from "react";
import axios from "axios";
import { Cpu, Play, CheckCircle2, XCircle, Loader2, ChevronRight, AlertTriangle } from "../icons";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";


const STEP_DESCRIPTIONS = {
  analyzer: "Understands what the issue actually is from feedback",
  planner: "Decides which files to touch and how to fix it",
  coder: "Writes the actual code patch",
  tester: "Generates unit tests and validates the fix",
  pr_creator: "Creates branch, commits patch, opens PR",
};

function PipelineClusterRow({ cluster, onRunPipeline, onResetCluster, onRetryCluster, repoName }) {
  const [agentRuns, setAgentRuns] = useState([]);
  const [loadedRuns, setLoadedRuns] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);

  const loadRuns = async () => {
    try {
      const r = await axios.get(`${API}/clusters/${cluster.id}/agents`);
      setAgentRuns(r.data);
      setLoadedRuns(true);
    } catch (_) {}
  };

  const handleExpand = () => {
    if (!loadedRuns) loadRuns();
    setExpanded((v) => !v);
  };

  const handleRun = async () => {
    setRunning(true);
    await onRunPipeline(cluster.id);
    setTimeout(() => {
      loadRuns();
      setExpanded(true);
      setRunning(false);
    }, 3000);
  };

  const priorityLevel =
    cluster.priority_score >= 8 ? { label: "Critical", cls: "text-red-400 bg-red-500/10 border-red-500/30" } :
    cluster.priority_score >= 4 ? { label: "High", cls: "text-orange-400 bg-orange-500/10 border-orange-500/30" } :
    cluster.priority_score >= 2 ? { label: "Medium", cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" } :
    { label: "Low", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" };

  return (
    <div className="glass overflow-hidden">
      {/* Row Header */}
      <div
        className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-white/3 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ChevronRight
            size={14}
            className={`text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{cluster.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{cluster.feedback_count} reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge border ${priorityLevel.cls}`}>{priorityLevel.label}</span>
          {cluster.status === "pending" && (
            <button
              onClick={(e) => { e.stopPropagation(); handleRun(); }}
              disabled={!repoName || running}
              className="btn-primary flex items-center gap-1.5 !py-1 !px-3 text-xs"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              {running ? "Starting…" : "Run"}
            </button>
          )}
          {cluster.status === "running" && (
            <>
              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                <Loader2 size={11} className="animate-spin" /> Running
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onResetCluster(cluster.id); }}
                className="btn-ghost !py-1 !px-2 text-xs"
                title="Mark as pending so you can rerun"
              >
                Reset
              </button>
            </>
          )}
          {cluster.status === "done" && <CheckCircle2 size={15} className="text-emerald-400" />}
          {cluster.status === "failed" && (
            <>
              <XCircle size={15} className="text-red-400" />
              <button
                onClick={(e) => { e.stopPropagation(); onRetryCluster(cluster.id); }}
                disabled={!repoName}
                className="btn-primary !py-1 !px-2 text-xs"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Agent Steps */}
      {expanded && (
        <div className="border-t border-white/8 p-4 animate-fade-in">
          {!repoName && cluster.status === "pending" && (
            <div className="flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <AlertTriangle size={13} />
              Enter a GitHub repo name in the ingest bar above before running the pipeline.
            </div>
          )}

          {/* Agent Steps Visual */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
            {["analyzer", "planner", "coder", "tester", "pr_creator"].map((agent, idx) => {
              const run = agentRuns.find((r) => r.agent_name === agent);
              const status = run?.status || "pending";
              const statusStyles = {
                pending: { border: "border-white/10", bg: "bg-white/3", icon: null, textColor: "text-slate-500" },
                running: { border: "border-yellow-500/40", bg: "bg-yellow-500/5", icon: <Loader2 size={14} className="animate-spin text-yellow-400" />, textColor: "text-yellow-400" },
                done:    { border: "border-emerald-500/40", bg: "bg-emerald-500/5", icon: <CheckCircle2 size={14} className="text-emerald-400" />, textColor: "text-emerald-400" },
                failed:  { border: "border-red-500/40", bg: "bg-red-500/5", icon: <XCircle size={14} className="text-red-400" />, textColor: "text-red-400" },
              };
              const s = statusStyles[status] || statusStyles.pending;
              return (
                <div key={agent} className={`rounded-xl p-3 border ${s.border} ${s.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold capitalize ${s.textColor}`}>{idx + 1}. {agent.replace("_", " ")}</span>
                    {s.icon}
                  </div>
                  <p className="text-[11px] text-slate-500">{STEP_DESCRIPTIONS[agent]}</p>
                  {run?.finished_at && (
                    <p className="text-[10px] text-slate-600 mt-2">
                      Done at {new Date(run.finished_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Agent Output Details */}
          {agentRuns.length > 0 && (
            <div className="space-y-2">
              {agentRuns.filter((r) => r.output && r.output !== "None" && r.output !== "").map((run) => (
                <div key={run.id} className="rounded-lg bg-black/30 border border-white/5 p-3">
                  <p className="text-[10px] text-slate-500 mb-1 capitalize font-medium">{run.agent_name.replace("_", " ")} output</p>
                  <p className="text-xs text-slate-400 line-clamp-3 font-mono">{run.output.slice(0, 300)}</p>
                </div>
              ))}
            </div>
          )}

          {agentRuns.length === 0 && cluster.status !== "pending" && (
            <p className="text-xs text-slate-600 text-center py-4">No agent run data yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Pipeline({ clusters, onRunPipeline, onResetCluster, onRetryCluster, repoName }) {
  const pending = clusters.filter((c) => c.status === "pending");
  const active  = clusters.filter((c) => c.status === "running");
  const done    = clusters.filter((c) => c.status === "done");
  const failed  = clusters.filter((c) => c.status === "failed");

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Cpu size={18} className="text-violet-400" />
          Pipeline Manager
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Select a cluster and run the 4-agent autonomous fix pipeline
        </p>
      </div>

      {/* Pipeline Flow Diagram */}
      <div className="glass p-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Pipeline Flow
        </h3>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {[
            { label: "Feedback", sub: "GitHub / Reddit / Twitter", color: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
            { label: "Analyzer", sub: "Root cause analysis", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
            { label: "Planner", sub: "Fix strategy", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
            { label: "Coder", sub: "Writes the patch", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
            { label: "Tester", sub: "Unit tests", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
            { label: "PR Created", sub: "GitHub pull request", color: "border-pink-500/40 bg-pink-500/10 text-pink-300" },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className={`rounded-xl border p-3 text-center w-32 ${step.color}`}>
                <p className="text-xs font-semibold">{step.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{step.sub}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="w-6 h-px bg-white/10 mx-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active / Running */}
      {active.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Running ({active.length})
          </h3>
          <div className="space-y-2">
            {active.map((c) => (
              <PipelineClusterRow
                key={c.id}
                cluster={c}
                onRunPipeline={onRunPipeline}
                onResetCluster={onResetCluster}
                onRetryCluster={onRetryCluster}
                repoName={repoName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">
            Ready to Run ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((c) => (
              <PipelineClusterRow
                key={c.id}
                cluster={c}
                onRunPipeline={onRunPipeline}
                onResetCluster={onResetCluster}
                onRetryCluster={onRetryCluster}
                repoName={repoName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Done */}
      {done.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 size={13} /> Completed ({done.length})
          </h3>
          <div className="space-y-2">
            {done.map((c) => (
              <PipelineClusterRow
                key={c.id}
                cluster={c}
                onRunPipeline={onRunPipeline}
                onResetCluster={onResetCluster}
                onRetryCluster={onRetryCluster}
                repoName={repoName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <XCircle size={13} /> Failed ({failed.length})
          </h3>
          <div className="space-y-2">
            {failed.map((c) => (
              <PipelineClusterRow
                key={c.id}
                cluster={c}
                onRunPipeline={onRunPipeline}
                onResetCluster={onResetCluster}
                onRetryCluster={onRetryCluster}
                repoName={repoName}
              />
            ))}
          </div>
        </section>
      )}

      {clusters.length === 0 && (
        <div className="glass flex flex-col items-center justify-center py-20 text-slate-500">
          <Cpu size={36} className="opacity-20 mb-3" />
          <p className="text-sm">No clusters found.</p>
          <p className="text-xs mt-1">Ingest some feedback first to create clusters.</p>
        </div>
      )}
    </div>
  );
}
