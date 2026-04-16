"use client";

import { useEffect, useState } from "react";
import { Loader2, BarChart3, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { RLDashboard } from "@/components/rl-dashboard";
import { SkeletonStats } from "@/components/ui/skeleton";
import type { RLEpisode, MetricsSummary } from "@/lib/types";

export default function RLMetricsPage() {
  const [episodes, setEpisodes] = useState<RLEpisode[]>([]);
  const [summary,  setSummary]  = useState<MetricsSummary | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([api.rlEpisodes(), api.summary()])
      .then(([ep, sum]) => {
        setEpisodes((ep as { episodes: RLEpisode[] }).episodes);
        setSummary(sum as unknown as MetricsSummary);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 page-header"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: "hsl(262 83% 65% / 0.1)",
                border: "1px solid hsl(262 83% 65% / 0.22)",
                boxShadow: "0 0 14px -3px hsl(262 83% 65% / 0.2)",
              }}
            >
              <BarChart3 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
                RL Metrics
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Feedback-driven confidence system — vault performance and reward history
              </p>
            </div>
            <div
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{
                background: "hsl(262 83% 65% / 0.08)",
                border: "1px solid hsl(262 83% 65% / 0.18)",
              }}
            >
              <TrendingUp className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                Live
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="space-y-5">
            <SkeletonStats count={4} />
            <div className="skeleton h-56 rounded-xl" />
            <div className="skeleton h-56 rounded-xl" />
          </div>
        ) : (
          <RLDashboard episodes={episodes} summary={summary} />
        )}
      </div>
    </div>
  );
}
