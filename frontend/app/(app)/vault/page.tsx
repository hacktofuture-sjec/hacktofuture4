"use client";

import { useEffect, useState } from "react";
import { Loader2, Database, Shield, Cpu, TrendingUp } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-orange-600 shadow-lg shadow-orange-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Memory Vault</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Human-approved Fixes · Institutional Memory
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Stats */}
        {loading ? (
          <SkeletonStats count={4} />
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Entries"
              value={stats.total ?? 0}
              icon={<Database className="w-4 h-4" />}
            />
            <StatCard
              label="Human Vault (T1)"
              value={stats.human_count ?? 0}
              accent="text-emerald-500"
              icon={<Shield className="w-4 h-4" />}
            />
            <StatCard
              label="Synthetic Cache (T2)"
              value={stats.synthetic_count ?? 0}
              accent="text-blue-500"
              icon={<Cpu className="w-4 h-4" />}
            />
            <StatCard
              label="Avg Confidence"
              value={stats.avg_confidence != null
                ? `${Math.round(stats.avg_confidence * 100)}%`
                : "—"}
              accent="text-orange-500"
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>
        ) : null}

        {/* Explorer */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Memory Vault...</p>
          </div>
        ) : (
          <VaultExplorer entries={entries} />
        )}
      </div>
    </div>
  );
}
