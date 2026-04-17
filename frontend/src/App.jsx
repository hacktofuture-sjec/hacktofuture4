import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Dashboard from "./pages/Dashboard";
import FeedbackPage from "./pages/Feedback";
import Pipeline from "./pages/Pipeline";
import {
  LayoutDashboard,
  MessageSquare,
  Cpu,
  GitPullRequest,
  RefreshCw,
  Zap,
} from "./icons";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",    icon: LayoutDashboard },
  { id: "feedback",  label: "Feedback",     icon: MessageSquare },
  { id: "pipeline", label: "Pipeline",     icon: Cpu },
  { id: "prs",      label: "Pull Requests", icon: GitPullRequest },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({});
  const [clusters, setClusters] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [query, setQuery] = useState("");
  const [includeGithub, setIncludeGithub] = useState(true);
  const [includeReddit, setIncludeReddit] = useState(true);
  const [includeHn, setIncludeHn] = useState(true);
  const [includeTwitter, setIncludeTwitter] = useState(false);
  const [strictMatch, setStrictMatch] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, f, p] = await Promise.allSettled([
        axios.get(`${API}/stats`),
        axios.get(`${API}/clusters`),
        axios.get(`${API}/feedback`),
        axios.get(`${API}/prs`),
      ]);
      if (s.status === "fulfilled") setStats(s.value.data);
      if (c.status === "fulfilled") setClusters(c.value.data);
      if (f.status === "fulfilled") setFeedback(f.value.data);
      if (p.status === "fulfilled") setPRs(p.value.data);
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [load]);

  const handleIngest = async () => {
    if (!repoName && !query) return;
    setIngestLoading(true);
    try {
      await axios.post(`${API}/ingest`, {
        repo_name: repoName,
        search_query: query,
        include_github: includeGithub,
        include_reddit: includeReddit,
        include_hackernews: includeHn,
        include_twitter: includeTwitter,
        strict_query_match: strictMatch,
      });
    } catch (e) {
      console.error("Ingest error:", e);
    }
    setTimeout(() => {
      setIngestLoading(false);
      load();
    }, 3000);
  };

  const handleRunPipeline = async (clusterId) => {
    await axios.post(`${API}/pipeline/run`, {
      cluster_id: clusterId,
      repo_name: repoName,
    });
    setTimeout(load, 2000);
  };

  const handleResetCluster = async (clusterId) => {
    await axios.post(`${API}/clusters/${clusterId}/reset`, {
      clear_agent_runs: true,
      target_status: "pending",
    });
    setTimeout(load, 1000);
  };

  const handleRetryCluster = async (clusterId) => {
    await handleResetCluster(clusterId);
    await axios.post(`${API}/pipeline/run`, {
      cluster_id: clusterId,
      repo_name: repoName,
    });
    setTimeout(load, 2000);
  };

  const clearFeedback = async () => {
    await axios.delete(`${API}/feedback`);
    load();
  };

  const clearClusters = async () => {
    await axios.delete(`${API}/clusters`);
    load();
  };

  const handleMarkOutcome = async (prId, outcome) => {
    try {
      await axios.post(`${API}/prs/${prId}/outcome`, { outcome });
      load(); // re-fetch stats + PRs to reflect new outcome in dashboard
    } catch (e) {
      console.error("Mark outcome error:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-violet-500/30 bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 12 20 20 7" />
                <line x1="12" y1="20" x2="12" y2="4" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">
              Vector<span className="text-violet-400">++</span>
            </span>
            <span className="hidden sm:block text-xs text-slate-500 border border-white/10 rounded-full px-2 py-0.5 ml-1">
              Autonomous Feedback-to-Fix
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  activeTab === id
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost flex items-center gap-2 !py-1.5 !px-3 text-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* ── Ingest Bar ── */}
      <div className="border-b border-white/10 bg-white/2">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col sm:flex-row items-center gap-3">
          <input
            className="input"
            placeholder="GitHub repo (e.g. facebook/react)"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Search query for Reddit/Twitter (e.g. 'login bug')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={handleIngest}
            disabled={ingestLoading}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            {ingestLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Ingesting…
              </>
            ) : (
              <>
                <Zap size={14} />
                Ingest Feedback
              </>
            )}
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3 flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: "GitHub", checked: includeGithub, set: setIncludeGithub },
            { label: "Reddit", checked: includeReddit, set: setIncludeReddit },
            { label: "HackerNews", checked: includeHn, set: setIncludeHn },
            { label: "Twitter", checked: includeTwitter, set: setIncludeTwitter },
            { label: "Strict query match", checked: strictMatch, set: setStrictMatch },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
              <input
                type="checkbox"
                checked={opt.checked}
                onChange={(e) => opt.set(e.target.checked)}
              />
              <span className="text-slate-300">{opt.label}</span>
            </label>
          ))}
          <button onClick={clearFeedback} className="btn-ghost !py-1 !px-2.5">Clear Feedback</button>
          <button onClick={clearClusters} className="btn-ghost !py-1 !px-2.5">Clear Clusters</button>
        </div>
      </div>

      {/* ── Page Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === "dashboard" && (
          <Dashboard
            stats={stats}
            clusters={clusters}
            repoName={repoName}
            onRunPipeline={handleRunPipeline}
            onRefresh={load}
          />
        )}
        {activeTab === "feedback" && <FeedbackPage feedback={feedback} />}
        {activeTab === "pipeline" && (
          <Pipeline
            clusters={clusters}
            onRunPipeline={handleRunPipeline}
            onResetCluster={handleResetCluster}
            onRetryCluster={handleRetryCluster}
            repoName={repoName}
          />
        )}
        {activeTab === "prs" && <PRsPage prs={prs} onMarkOutcome={handleMarkOutcome} />}
      </main>
    </div>
  );
}

// --- Inline PRs Page ---
function PRsPage({ prs, onMarkOutcome }) {
  if (!prs || prs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <GitPullRequest size={40} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">No pull requests yet</p>
        <p className="text-sm mt-1">Run a pipeline on a cluster to generate an autonomous PR</p>
      </div>
    );
  }

  const statusColors = {
    open:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    merged:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    failed:   "bg-red-500/10 text-red-400 border-red-500/20",
    pending:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-xl font-semibold mb-6">
        Generated Pull Requests
        <span className="ml-2 badge bg-white/10 text-slate-400">{prs.length}</span>
      </h2>
      {prs.map((pr) => (
        <div key={pr.id} className="glass glass-hover p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <GitPullRequest size={14} className="text-violet-400 shrink-0" />
              <span className="font-medium text-sm truncate">{pr.branch_name}</span>
              <span className={`badge border ${statusColors[pr.status] || "bg-white/10 text-slate-400"}`}>
                {pr.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cluster #{pr.cluster_id} • {new Date(pr.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Mark outcome buttons — only show if still open */}
            {pr.status === "open" && (
              <>
                <button
                  onClick={() => onMarkOutcome(pr.id, "merged")}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-medium"
                >
                  ✓ Mark Merged
                </button>
                <button
                  onClick={() => onMarkOutcome(pr.id, "rejected")}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium"
                >
                  ✗ Mark Rejected
                </button>
              </>
            )}
            <a
              href={pr.github_pr_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-xs !py-1.5 !px-3 shrink-0"
            >
              View PR →
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

