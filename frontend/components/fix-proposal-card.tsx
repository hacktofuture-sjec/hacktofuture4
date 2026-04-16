"use client";

import { Shield, Cpu, Sparkles, ChevronDown, TrendingDown, Brain } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FixProposal } from "@/lib/types";

const TIER_CONFIG = {
  T1_human: {
    icon: Shield,
    label: "T1 Human Vault",
    variant: "success" as const,
    note: "Retrieved from human-approved fix vault",
    accent: "hsl(142 69% 42%)",
    bg: "hsl(142 69% 42% / 0.07)",
  },
  T2_synthetic: {
    icon: Cpu,
    label: "T2 Synthetic Cache",
    variant: "info" as const,
    note: "Retrieved from AI-generated, human-validated cache",
    accent: "hsl(199 89% 54%)",
    bg: "hsl(199 89% 54% / 0.07)",
  },
  T3_llm: {
    icon: Sparkles,
    label: "T3 LLM Synthesis",
    variant: "warning" as const,
    note: "No vault match — synthesised fresh by LLM",
    accent: "hsl(38 92% 50%)",
    bg: "hsl(38 92% 50% / 0.07)",
  },
};

export function FixProposalCard({ fix }: { fix: FixProposal }) {
  const [diffOpen,    setDiffOpen]    = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [rlmOpen,     setRlmOpen]     = useState(false);

  const cfg       = TIER_CONFIG[fix.tier] ?? TIER_CONFIG.T3_llm;
  const TierIcon  = cfg.icon;
  const pct       = Math.round(fix.confidence * 100);
  const skipped   = fix.skipped_fixes ?? [];
  const rlmTrace  = fix.rlm_trace ?? [];

  const barColor  = pct >= 75 ? "hsl(142 69% 42%)" : pct >= 50 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${cfg.accent}22`,
        background: "hsl(var(--card))",
        boxShadow: `0 0 28px -10px ${cfg.accent}18`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${cfg.accent}18`,
          background: cfg.bg,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Fix Proposal
        </p>
        <Badge variant={cfg.variant} className="gap-1">
          <TierIcon className="w-3 h-3" />
          {cfg.label}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {fix.similarity_score != null && (
            <span>
              Similarity{" "}
              <span className="text-foreground font-mono font-bold">
                {(fix.similarity_score * 100).toFixed(1)}%
              </span>
            </span>
          )}
          <span>
            Confidence{" "}
            <span className="font-mono font-bold" style={{ color: barColor }}>
              {pct}%
            </span>
          </span>
          {fix.reward_score !== undefined && (
            <span>
              Vault reward{" "}
              <span
                className="font-mono font-bold"
                style={{ color: fix.reward_score >= 0 ? "hsl(142 69% 42%)" : "hsl(0 72% 51%)" }}
              >
                {fix.reward_score >= 0 ? "+" : ""}{fix.reward_score.toFixed(2)}
              </span>
            </span>
          )}
        </div>

        {/* Confidence bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "hsl(var(--muted))" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: barColor,
              boxShadow: `0 0 8px -1px ${barColor}80`,
            }}
          />
        </div>

        {/* Description */}
        <p className="text-sm text-foreground leading-relaxed">{fix.fix_description}</p>

        {/* Commands */}
        {fix.fix_commands.length > 0 && (
          <div
            className="rounded-lg p-3.5 space-y-1.5 font-mono text-[12px]"
            style={{
              background: "hsl(224 30% 4%)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            {fix.fix_commands.map((cmd, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-muted-foreground select-none opacity-50">$</span>
                <span className="text-emerald-300">{cmd}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reasoning */}
        {fix.reasoning && (
          <div
            className="rounded-lg px-3.5 py-3 text-[12px] text-muted-foreground leading-relaxed"
            style={{
              background: "hsl(var(--muted) / 0.4)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <span className="font-bold text-foreground">Reasoning: </span>
            {fix.reasoning}
          </div>
        )}

        {/* Diff collapsible */}
        {fix.fix_diff && (
          <div>
            <button
              onClick={() => setDiffOpen(!diffOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", diffOpen && "rotate-180")} />
              View diff
            </button>
            {diffOpen && (
              <pre
                className="mt-2 p-3.5 rounded-lg text-[11px] font-mono overflow-x-auto whitespace-pre text-muted-foreground leading-relaxed"
                style={{
                  background: "hsl(224 30% 4%)",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {fix.fix_diff}
              </pre>
            )}
          </div>
        )}

        {/* RLM trace */}
        {rlmTrace.length > 0 && (
          <div>
            <button
              onClick={() => setRlmOpen(!rlmOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Brain className="w-3 h-3 text-indigo-400" />
              <ChevronDown className={cn("w-3 h-3 transition-transform", rlmOpen && "rotate-180")} />
              RLM scan trace ({rlmTrace.length} step{rlmTrace.length !== 1 ? "s" : ""})
            </button>
            {rlmOpen && (
              <div className="mt-2 space-y-2">
                {rlmTrace.map((step, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3 text-[11px] font-mono space-y-1"
                    style={{
                      background: "hsl(224 30% 4%)",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <p className="text-indigo-400">Depth-{step.depth} · {(step.confidence * 100).toFixed(0)}% confidence</p>
                    <p className="text-muted-foreground">Hotspot: <span className="text-foreground">{step.hotspot}</span></p>
                    <p className="text-muted-foreground">Finding: <span className="text-foreground">{step.finding}</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skipped fixes */}
        {skipped.length > 0 && (
          <div>
            <button
              onClick={() => setSkippedOpen(!skippedOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <TrendingDown className="w-3 h-3 text-red-400" />
              <ChevronDown className={cn("w-3 h-3 transition-transform", skippedOpen && "rotate-180")} />
              {skipped.length} fix{skipped.length !== 1 ? "es" : ""} skipped by RL ranker
            </button>
            {skippedOpen && (
              <div className="mt-2 space-y-1.5">
                {skipped.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5 text-[11px] space-y-0.5"
                    style={{
                      background: "hsl(0 72% 51% / 0.06)",
                      border: "1px solid hsl(0 72% 51% / 0.15)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-mono">reward</span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: s.reward_score >= 0 ? "hsl(142 69% 42%)" : "hsl(0 72% 51%)" }}
                      >
                        {s.reward_score >= 0 ? "+" : ""}{s.reward_score.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-foreground truncate">{s.fix_description}</p>
                    <p className="text-muted-foreground italic">{s.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic opacity-60">{cfg.note}</p>
      </div>
    </div>
  );
}
