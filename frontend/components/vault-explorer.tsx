"use client";

import { useState } from "react";
import { Shield, Cpu, Search, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VaultEntry } from "@/lib/types";

type SortKey = "confidence" | "retrieval_count" | "created_at";

interface Props {
  entries: VaultEntry[];
}

export function VaultExplorer({ entries }: Props) {
  const [filter, setFilter] = useState<"all" | "human" | "synthetic">("all");
  const [query,  setQuery]  = useState("");
  const [sort,   setSort]   = useState<SortKey>("confidence");
  const [desc,   setDesc]   = useState(true);

  function toggleSort(key: SortKey) {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(true); }
  }

  const filtered = entries
    .filter((e) => {
      if (filter !== "all" && e.source !== filter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (e.failure_type ?? "").toLowerCase().includes(q) ||
        (e.fix_description ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = a[sort] as number | string;
      const bv = b[sort] as number | string;
      return desc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
    });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fixes, failure types, or signatures..."
            className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl
                       text-slate-900 placeholder:text-slate-400 font-medium
                       focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 shadow-sm transition-all"
          />
        </div>
        <div className="flex p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
          {(["all", "human", "synthetic"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                filter === f
                  ? "bg-slate-900 text-white shadow-lg"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[1fr_100px_100px_110px] gap-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <span>Institutional Knowledge</span>
          {(["confidence", "retrieval_count", "created_at"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors text-left"
            >
              {key === "confidence" ? "Conf." : key === "retrieval_count" ? "Hits" : "Date"}
              <ArrowUpDown className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl py-32 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
            <Search className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {query ? `No knowledge found for "${query}"` : "Memory Vault is currently empty"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <VaultRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultRow({ entry }: { entry: VaultEntry }) {
  const pct = Math.round(entry.confidence * 100);
  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="group bg-white border border-slate-100 rounded-2xl px-6 py-5 shadow-sm transition-all hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-100 cursor-pointer">
      <div className="flex items-start gap-5">
        {/* Source icon */}
        <div className={cn(
          "shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:scale-110",
          entry.source === "human" ? "bg-emerald-50" : "bg-blue-50"
        )}>
          {entry.source === "human"
            ? <Shield className="w-5 h-5 text-emerald-600" />
            : <Cpu    className="w-5 h-5 text-blue-600" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {entry.failure_type && (
              <Badge variant="muted" className="font-black text-[10px] tracking-widest opacity-80 uppercase">{entry.failure_type}</Badge>
            )}
            <Badge variant={entry.source === "human" ? "success" : "info"} className="font-black text-[10px] tracking-widest uppercase">
              {entry.source}
            </Badge>
          </div>
          <p className="text-base font-bold text-slate-800 line-clamp-2 leading-relaxed">
            {entry.fix_description ?? "No fix description provided."}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Sig: <span className="text-slate-500 font-mono lowercase">{entry.failure_signature}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right space-y-3">
          <div className="flex items-center gap-3 justify-end">
            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div className={cn("h-full rounded-full transition-all duration-1000", barColor)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black text-slate-900 w-10 text-right">{pct}%</span>
          </div>
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
              {entry.retrieval_count} Hits
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
