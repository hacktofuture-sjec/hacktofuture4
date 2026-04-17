import { useState, useMemo } from "react";
import { Github, Twitter, Globe, Search, AlertCircle } from "../icons";

const SOURCE_ICONS = {
  github: Github,
  twitter: Twitter,
  reddit: Globe,
  hackernews: Globe,
};

const SOURCE_COLORS = {
  github: "bg-slate-700/60 text-slate-300 border-slate-600/40",
  twitter: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  reddit: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  hackernews: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const STATUS_COLORS = {
  raw: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  clustered: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  processing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function FeedbackCard({ item }) {
  const Icon = SOURCE_ICONS[item.source] || Globe;
  const sourceCls = SOURCE_COLORS[item.source] || "bg-white/10 text-slate-400 border-white/10";
  const statusCls = STATUS_COLORS[item.status] || "bg-white/10 text-slate-400";
  const text = item.text || "";

  return (
    <div className="glass glass-hover p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg border ${sourceCls} shrink-0`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`badge border capitalize ${sourceCls}`}>{item.source}</span>
            <span className={`badge border ${statusCls}`}>{item.status}</span>
            {item.cluster_id && (
              <span className="badge bg-violet-500/10 text-violet-400 border-violet-500/20">
                cluster #{item.cluster_id}
              </span>
            )}
            <span className="text-xs text-slate-500 ml-auto">{item.author}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{text}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {new Date(item.created_at).toLocaleString()}
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View source →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage({ feedback }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const sources = useMemo(() => {
    const s = new Set((feedback || []).map((f) => f.source));
    return ["all", ...s];
  }, [feedback]);

  const filtered = useMemo(() => {
    return (feedback || []).filter((f) => {
      const matchSource = filter === "all" || f.source === filter;
      const matchSearch = !search || f.text?.toLowerCase().includes(search.toLowerCase());
      return matchSource && matchSearch;
    });
  }, [feedback, filter, search]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Raw Feedback</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} of {(feedback || []).length} items</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Source filter */}
          <div className="flex gap-1">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === s
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input !pl-8 !py-1.5 w-48 text-xs"
              placeholder="Search feedback…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Feedback Grid */}
      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-20 text-slate-500">
          <AlertCircle size={36} className="opacity-20 mb-3" />
          <p className="text-sm font-medium">No feedback items found</p>
          <p className="text-xs mt-1">
            {search ? "Try a different search term" : "Ingest some feedback from the bar above"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FeedbackCard key={f.id} item={f} />
          ))}
        </div>
      )}
    </div>
  );
}
