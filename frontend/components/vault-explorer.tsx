"use client";

import { useState } from "react";
import { Shield, Cpu, Search, ArrowUpDown, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, fmtPct } from "@/lib/utils";
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
    <div className="space-y-4">
      {/* ── Controls ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fixes, failure types…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
            style={{
              background: "hsl(var(--muted) / 0.5)",
              border: "1px solid hsl(var(--border))",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "hsl(217 91% 60% / 0.4)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px hsl(217 91% 60% / 0.08)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          />
        </div>

        <div
          className="flex rounded-xl overflow-hidden text-xs"
          style={{ border: "1px solid hsl(var(--border))" }}
        >
          {(["all", "human", "synthetic"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3.5 py-2 capitalize font-medium transition-all duration-150")}
              style={filter === f ? {
                background: "hsl(217 91% 60% / 0.12)",
                color: "hsl(217 91% 60%)",
                borderRight: f !== "synthetic" ? "1px solid hsl(217 91% 60% / 0.15)" : "none",
              } : {
                color: "hsl(var(--muted-foreground))",
                borderRight: f !== "synthetic" ? "1px solid hsl(var(--border))" : "none",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sort header ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[1fr_80px_70px_90px] gap-2 px-4 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Fix Entry
          </span>
          {(["confidence", "retrieval_count", "created_at"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={cn(
                "flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] hover:text-foreground transition-colors text-left",
                sort === key ? "text-primary" : "text-muted-foreground"
              )}
            >
              {key === "confidence" ? "Conf" : key === "retrieval_count" ? "Hits" : "Date"}
              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
            </button>
          ))}
        </div>
      )}

      {/* ── Entries ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl text-center"
          style={{
            border: "1px dashed hsl(var(--border))",
            background: "hsl(var(--muted) / 0.2)",
          }}
        >
          <BarChart2 className="w-8 h-8 text-muted-foreground opacity-30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {query ? `No matches for "${query}"` : "Vault is empty"}
          </p>
          {!query && (
            <p className="text-xs text-muted-foreground opacity-60 mt-1">
              Run a pipeline to populate the memory vault
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, i) => (
            <div key={entry.id} className="fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <VaultRow entry={entry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VaultRow({ entry }: { entry: VaultEntry }) {
  const pct = Math.round(entry.confidence * 100);
  const isHuman = entry.source === "human";

  const barColor = pct >= 75 ? "hsl(142 69% 42%)" : pct >= 50 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";
  const accent   = isHuman ? "hsl(142 69% 42%)" : "hsl(199 89% 54%)";

  return (
    <div
      className="grid sm:grid-cols-[1fr_80px_70px_90px] items-center gap-2 px-4 py-3.5 rounded-xl transition-all duration-150 card-hover"
      style={{
        background: "hsl(var(--card))",
        border: `1px solid ${accent}18`,
      }}
    >
      {/* Main content */}
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="mt-0.5 flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ background: `${accent}14`, border: `1px solid ${accent}24` }}
        >
          {isHuman
            ? <Shield className="w-3.5 h-3.5" style={{ color: accent }} />
            : <Cpu    className="w-3.5 h-3.5" style={{ color: accent }} />
          }
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.failure_type && (
              <Badge variant="muted">{entry.failure_type.toUpperCase()}</Badge>
            )}
            <Badge variant={isHuman ? "success" : "info"}>
              {isHuman ? "T1 Human" : "T2 Synthetic"}
            </Badge>
          </div>
          <p className="text-sm text-foreground truncate font-medium">
            {entry.fix_description ?? "No description"}
          </p>
          {entry.reward_score !== undefined && (
            <p
              className={cn("text-[10px] font-mono font-bold")}
              style={{ color: entry.reward_score >= 0 ? "hsl(142 69% 42%)" : "hsl(0 72% 51%)" }}
            >
              {entry.reward_score >= 0 ? "+" : ""}{entry.reward_score.toFixed(2)} reward
            </p>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div className="hidden sm:flex flex-col items-end gap-1.5">
        <span className="text-xs font-bold font-mono" style={{ color: barColor }}>
          {pct}%
        </span>
        <div
          className="w-16 h-1.5 rounded-full overflow-hidden"
          style={{ background: "hsl(var(--muted))" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      </div>

      {/* Hits */}
      <div className="hidden sm:block text-right">
        <span className="text-xs font-mono text-muted-foreground">
          {entry.retrieval_count}
        </span>
      </div>

      {/* Date */}
      <div className="hidden sm:block text-right">
        <span className="text-[10px] text-muted-foreground font-mono">
          {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
