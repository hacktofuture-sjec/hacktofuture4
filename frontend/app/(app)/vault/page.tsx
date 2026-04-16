"use client";

import { useEffect, useState } from "react";
import { Loader2, Database, Shield, Cpu, TrendingUp, Lock } from "lucide-react";
import { api } from "@/lib/api-client";
import { VaultExplorer } from "@/components/vault-explorer";
import { StatCard } from "@/components/ui/stat-card";
import { SkeletonStats } from "@/components/ui/skeleton";
import type { VaultEntry } from "@/lib/types";

interface VaultStats {
  total:           number;
  human_count:     number;
  synthetic_count: number;
  avg_confidence:  number | null;
}

export default function VaultPage() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [stats,   setStats]   = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listVault(), api.vaultStats()])
      .then(([vault, st]) => {
        setEntries((vault as { entries: VaultEntry[] }).entries);
        setStats(st as unknown as VaultStats);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 page-header"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: "hsl(142 69% 42% / 0.1)",
                border: "1px solid hsl(142 69% 42% / 0.22)",
                boxShadow: "0 0 14px -3px hsl(142 69% 42% / 0.2)",
              }}
            >
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
                Memory Vault
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Human-approved and AI-validated fixes powering tiered retrieval
              </p>
            </div>
            <div
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{
                background: "hsl(142 69% 42% / 0.08)",
                border: "1px solid hsl(142 69% 42% / 0.18)",
              }}
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                RLM Active
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* ── Stats ─────────────────────────────────────────────── */}
        {loading ? (
          <SkeletonStats count={4} />
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total Entries"
              value={stats.total ?? 0}
              icon={<Database className="w-4 h-4" />}
              accent="hsl(217 91% 60%)"
            />
            <StatCard
              label="Human Vault (T1)"
              value={stats.human_count ?? 0}
              sub="Highest trust"
              icon={<Shield className="w-4 h-4" />}
              accent="hsl(142 69% 42%)"
            />
            <StatCard
              label="Synthetic (T2)"
              value={stats.synthetic_count ?? 0}
              sub="AI-validated"
              icon={<Cpu className="w-4 h-4" />}
              accent="hsl(199 89% 54%)"
            />
            <StatCard
              label="Avg Confidence"
              value={stats.avg_confidence != null
                ? `${Math.round(stats.avg_confidence * 100)}%`
                : "—"}
              icon={<TrendingUp className="w-4 h-4" />}
              accent="hsl(262 83% 65%)"
            />
          </div>
        ) : null}

        {/* ── Explorer ──────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading vault entries…</p>
            </div>
          </div>
        ) : (
          <VaultExplorer entries={entries} />
        )}
      </div>
    </div>
  );
}
