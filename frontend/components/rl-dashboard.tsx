"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { TrendingUp, Target, Database, Award, Shield, Cpu, Sparkles } from "lucide-react";
import type { RLEpisode, MetricsSummary } from "@/lib/types";

const OUTCOME_COLORS: Record<string, string> = {
  success:  "#22c55e",
  failure:  "#ef4444",
  rejected: "#a78bfa",
};

const TOOLTIP_STYLE = {
  background: "hsl(224 28% 6%)",
  border:     "1px solid hsl(224 18% 14%)",
  borderRadius: 8,
  fontSize: 11,
  padding: "8px 12px",
  boxShadow: "0 4px 16px -4px hsl(0 0% 0% / 0.4)",
};

interface Props {
  episodes: RLEpisode[];
  summary:  MetricsSummary | null;
}

function SectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
      }}
    >
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

export function RLDashboard({ episodes, summary }: Props) {
  const rewardData = [...episodes].reverse().map((ep, i) => ({
    i: i + 1,
    reward:     +ep.reward.toFixed(3),
    cumulative: +ep.cumulative_reward.toFixed(3),
  }));

  const outcomeCounts: Record<string, number> = { success: 0, failure: 0, rejected: 0 };
  for (const ep of episodes) {
    if (ep.outcome && ep.outcome in outcomeCounts) outcomeCounts[ep.outcome]++;
  }
  const pieData = Object.entries(outcomeCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const tierCounts: Record<string, number> = {};
  for (const ep of episodes) {
    if (ep.fix_tier) tierCounts[ep.fix_tier] = (tierCounts[ep.fix_tier] ?? 0) + 1;
  }

  const TIERS = [
    {
      key: "T1_human",
      label: "T1 Human Vault",
      icon: Shield,
      color: "hsl(142 69% 42%)",
      track: "hsl(142 69% 42% / 0.15)",
    },
    {
      key: "T2_synthetic",
      label: "T2 Synthetic Cache",
      icon: Cpu,
      color: "hsl(199 89% 54%)",
      track: "hsl(199 89% 54% / 0.15)",
    },
    {
      key: "T3_llm",
      label: "T3 LLM Synthesis",
      icon: Sparkles,
      color: "hsl(38 92% 50%)",
      track: "hsl(38 92% 50% / 0.15)",
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Summary stats ────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Incidents"
            value={summary.total_incidents ?? 0}
            icon={<Target className="w-4 h-4" />}
            accent="hsl(217 91% 60%)"
          />
          <StatCard
            label="Resolved"
            value={summary.resolved_count ?? 0}
            sub={summary.total_incidents
              ? `${Math.round(((summary.resolved_count ?? 0) / summary.total_incidents) * 100)}% success`
              : undefined}
            trend="up"
            icon={<TrendingUp className="w-4 h-4" />}
            accent="hsl(142 69% 42%)"
          />
          <StatCard
            label="Vault Size"
            value={summary.vault_size ?? 0}
            icon={<Database className="w-4 h-4" />}
            accent="hsl(199 89% 54%)"
          />
          <StatCard
            label="Avg Confidence"
            value={summary.avg_confidence != null
              ? `${Math.round(summary.avg_confidence * 100)}%`
              : "—"}
            icon={<Award className="w-4 h-4" />}
            accent="hsl(262 83% 65%)"
          />
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cumulative reward trend */}
        <SectionPanel title="Cumulative Reward Trend">
          <div className="p-4">
            {rewardData.length === 0 ? (
              <EmptyChart message="No episodes yet" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={rewardData} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                  <XAxis
                    dataKey="i"
                    tick={{ fontSize: 10, fill: "hsl(215 12% 42%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(215 12% 42%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "hsl(215 22% 90%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                    dot={false}
                    name="Cumulative"
                    style={{ filter: "drop-shadow(0 0 4px hsl(217 91% 60% / 0.5))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reward"
                    stroke="hsl(142 69% 42%)"
                    strokeWidth={1.5}
                    dot={false}
                    name="Episode reward"
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionPanel>

        {/* Outcome distribution */}
        <SectionPanel title="Fix Outcome Distribution">
          <div className="p-4">
            {pieData.length === 0 ? (
              <EmptyChart message="No outcomes yet" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={OUTCOME_COLORS[entry.name] ?? "#888"}
                        style={{ filter: `drop-shadow(0 0 6px ${OUTCOME_COLORS[entry.name] ?? "#888"}60)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    formatter={(v) => (
                      <span style={{ fontSize: 11, color: "hsl(215 12% 60%)", textTransform: "capitalize" }}>
                        {v}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionPanel>
      </div>

      {/* ── Tier breakdown ────────────────────────────────────── */}
      {Object.keys(tierCounts).length > 0 && (
        <SectionPanel title="Fix Tier Distribution">
          <div className="p-5 space-y-4">
            {TIERS.map(({ key, label, icon: Icon, color, track }) => {
              const count = tierCounts[key] ?? 0;
              const pct   = episodes.length > 0 ? (count / episodes.length) * 100 : 0;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center w-6 h-6 rounded-md"
                        style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                      >
                        <Icon className="w-3 h-3" style={{ color }} />
                      </div>
                      <span className="text-xs font-medium text-foreground">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color }}>
                        {count}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(pct)}%)
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: track }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        boxShadow: `0 0 8px -1px ${color}80`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[190px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground opacity-60">{message}</p>
    </div>
  );
}
