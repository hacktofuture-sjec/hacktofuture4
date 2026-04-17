import { useState } from "react";
import axios from "axios";
import {
  MessageSquare, Github, Twitter,
  TrendingUp, BarChart3, CheckCircle2, XCircle, Clock, Loader2,
  Brain, GitMerge, AlertTriangle,
} from "../icons";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";


const STATUS_CONFIG = {
  pending: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30",   dot: "bg-slate-400" },
  running: { color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400 animate-pulse" },
  done:    { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  failed:  { color: "bg-red-500/20 text-red-400 border-red-500/30",          dot: "bg-red-400" },
};

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  const bgMap = {
    "text-violet-400": "bg-violet-500/10",
    "text-cyan-400":   "bg-cyan-500/10",
    "text-emerald-400":"bg-emerald-500/10",
    "text-amber-400":  "bg-amber-500/10",
    "text-pink-400":   "bg-pink-500/10",
    "text-sky-400":    "bg-sky-500/10",
  };
  return (
    <div className="glass p-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? "—"}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${bgMap[color] || "bg-white/5"}`}>
        <Icon size={20} className={color} />
      </div>
    </div>
  );
}

// ── Agent Timeline ────────────────────────────────────────────────────────────
export function AgentTimeline({ agentRuns }) {
  const agents = ["analyzer", "planner", "coder", "tester", "sandbox", "pr_creator"];
  const runMap = {};
  (agentRuns || []).forEach((r) => { runMap[r.agent_name] = r; });

  return (
    <div className="flex items-center gap-0 mt-3">
      {agents.map((agent, i) => {
        const run = runMap[agent];
        const status = run?.status || "pending";
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return (
          <div key={agent} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} title={`${agent}: ${status}`} />
              <span className="text-[10px] text-slate-500 capitalize">{agent.replace("_", " ")}</span>
            </div>
            {i < agents.length - 1 && (
              <div className={`w-6 h-px mx-1 mb-3.5 ${run?.status === "done" ? "bg-violet-500/60" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Cluster Card ─────────────────────────────────────────────────────────────
function ClusterCard({ cluster, agentRuns, onRunPipeline, repoName }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[cluster.status] || STATUS_CONFIG.pending;
  const priorityBorder =
    cluster.priority_score >= 8 ? "border-red-500/40" :
    cluster.priority_score >= 4 ? "border-orange-500/30" :
    cluster.priority_score >= 2 ? "border-yellow-500/30" : "border-white/10";

  return (
    <div className={`glass border ${priorityBorder} p-5 animate-slide-up transition-all duration-200`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{cluster.label}</h3>
            <span className={`badge border ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {cluster.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            <TrendingUp size={10} className="inline mr-1" />
            {cluster.feedback_count} reports &nbsp;·&nbsp; Priority score: {cluster.priority_score.toFixed(1)}
          </p>
          <AgentTimeline agentRuns={agentRuns} />
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {cluster.status === "pending" && (
            <button
              onClick={() => onRunPipeline(cluster.id)}
              disabled={!repoName}
              className="btn-primary text-xs !py-1.5 !px-3"
              title={!repoName ? "Enter a GitHub repo name first" : ""}
            >
              Run Pipeline →
            </button>
          )}
          {cluster.status === "running" && (
            <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
              <Loader2 size={12} className="animate-spin" /> Processing…
            </div>
          )}
          {cluster.status === "done" && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle2 size={12} /> PR created
            </div>
          )}
          {cluster.status === "failed" && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs">
              <XCircle size={12} /> Failed
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? "▲ Less" : "▼ More"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/8 space-y-2 animate-fade-in">
          <p className="text-xs text-slate-500">
            Created: {new Date(cluster.created_at).toLocaleString()}
          </p>
          {(agentRuns || []).map((run) => (
            <div key={run.id} className="bg-white/3 rounded-lg p-3 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium capitalize text-slate-300">{run.agent_name}</span>
                <span className={`badge border ${STATUS_CONFIG[run.status]?.color}`}>{run.status}</span>
                {run.finished_at && (
                  <span className="text-slate-500 ml-auto">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(run.finished_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {run.output && run.output !== "None" && (
                <p className="text-slate-400 line-clamp-2">{run.output.slice(0, 200)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Learning Panel ────────────────────────────────────────────────────────────
function LearningsPanel({ stats }) {
  const merged   = stats.learnings?.merged_fixes   || 0;
  const rejected = stats.learnings?.rejected_fixes || 0;
  const total    = merged + rejected;
  const rate     = total > 0 ? Math.round((merged / total) * 100) : null;

  return (
    <div className="glass p-5">
      <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2">
        <Brain size={14} className="text-violet-400" />
        Learning Memory
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <GitMerge size={12} className="text-emerald-400" />
            <span className="text-slate-400">Merged fixes</span>
          </div>
          <span className="font-semibold text-emerald-400">{merged}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <XCircle size={12} className="text-red-400" />
            <span className="text-slate-400">Rejected</span>
          </div>
          <span className="font-semibold text-red-400">{rejected}</span>
        </div>
        {rate !== null && (
          <div className="pt-2 border-t border-white/8">
            <p className="text-xs text-slate-500 mb-1">Merge rate</p>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-xs text-emerald-400 mt-1 font-semibold">{rate}%</p>
          </div>
        )}
        {total === 0 && (
          <p className="text-xs text-slate-600 mt-1">
            No outcomes recorded yet. After a PR is merged or rejected, mark it via the Pull Requests tab to train future suggestions.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
export default function Dashboard({ stats, clusters, repoName, onRunPipeline }) {
  const [agentRunsMap, setAgentRunsMap] = useState({});

  const loadAgentRuns = async (clusterId) => {
    if (agentRunsMap[clusterId]) return;
    try {
      const r = await axios.get(`${API}/clusters/${clusterId}/agents`);
      setAgentRunsMap((prev) => ({ ...prev, [clusterId]: r.data }));
    } catch (_) {}
  };

  // Load on render
  useState(() => {
    clusters.forEach((c) => loadAgentRuns(c.id));
  });

  // Pie data for source breakdown
  const pieData = [
    { name: "Google Reviews",  value: stats.feedback_by_source?.google_reviews     || 0 },
    { name: "Yelp",  value: stats.feedback_by_source?.yelp     || 0 },
    { name: "Manual", value: stats.feedback_by_source?.manual    || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Stats Row — 6 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Feedback"  value={stats.total_feedback}   icon={MessageSquare} color="text-violet-400" sub="from all sources" />
        <StatCard label="Issue Clusters"  value={stats.total_clusters}   icon={BarChart3}     color="text-cyan-400"   sub={`${stats.clusters_done || 0} resolved`} />
        <StatCard label="PRs Generated"   value={stats.total_prs}        icon={Github}        color="text-emerald-400" sub="autonomous fixes" />
        <StatCard label="Agent Runs"      value={stats.total_agent_runs} icon={Clock}         color="text-amber-400"  sub={`${stats.clusters_running || 0} active now`} />
        <StatCard label="Fixes Merged"    value={stats.learnings?.merged_fixes   ?? "—"} icon={GitMerge}    color="text-sky-400"    sub="learned outcomes" />
        <StatCard label="Fixes Rejected"  value={stats.learnings?.rejected_fixes ?? "—"} icon={AlertTriangle} color="text-pink-400" sub="rejected by devs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clusters List */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-400" />
            Issue Clusters
            <span className="badge bg-white/10 text-slate-400">{clusters.length}</span>
            <span className="text-xs text-slate-500 font-normal ml-1">sorted by priority</span>
          </h2>

          {clusters.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center py-20 text-slate-500">
              <MessageSquare size={36} className="opacity-20 mb-3" />
              <p className="text-sm">No clusters yet.</p>
              <p className="text-xs mt-1">Enter a GitHub repo and search query above, then click Ingest.</p>
            </div>
          ) : (
            clusters.map((c) => (
              <ClusterCard
                key={c.id}
                cluster={c}
                agentRuns={agentRunsMap[c.id] || []}
                onRunPipeline={(id) => {
                  onRunPipeline(id);
                  setTimeout(() => loadAgentRuns(id), 3000);
                }}
                repoName={repoName}
              />
            ))
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Pipeline Status Summary */}
          <div className="glass p-5">
            <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-violet-400" />
              Pipeline Status
            </h3>
            <div className="space-y-3">
              {[
                { label: "Pending", val: (stats.total_clusters || 0) - (stats.clusters_running || 0) - (stats.clusters_done || 0) - (stats.clusters_failed || 0), color: "bg-slate-500" },
                { label: "Running", val: stats.clusters_running || 0, color: "bg-yellow-400" },
                { label: "Done",    val: stats.clusters_done   || 0, color: "bg-emerald-400" },
                { label: "Failed",  val: stats.clusters_failed || 0, color: "bg-red-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-slate-400">{label}</span>
                  </div>
                  <span className="font-semibold text-slate-200">{Math.max(0, val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Memory Panel */}
          <LearningsPanel stats={stats} />

          {/* Source Breakdown Pie */}
          {pieData.length > 0 && (
            <div className="glass p-5">
              <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2">
                <Twitter size={14} className="text-violet-400" />
                Feedback Sources
              </h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How It Works */}
          <div className="glass p-5">
            <h3 className="font-semibold text-sm text-slate-200 mb-3">How It Works</h3>
            <ol className="space-y-2">
              {[
                "Ingest feedback from GitHub, Reddit & Twitter",
                "Embed & cluster similar reports with DBSCAN",
                "Analyzer understands the root issue",
                "Planner creates a fix strategy (enriched with past learnings)",
                "Coder writes the patch",
                "Tester writes unit tests",
                "Sandbox validates tests before touching real repo",
                "PR is automatically opened on GitHub",
                "Reporters are notified via GitHub comments",
                "Outcome is recorded to improve future fixes",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-bold mt-px">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
