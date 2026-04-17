"use client";

import { Shield, Cpu, Sparkles, ChevronDown, Brain } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn, fmtPct } from "@/lib/utils";
import type { FixProposal } from "@/lib/types";

const TIER = {
  T1_human: {
    icon: Shield, label: "T1 Human Pattern", variant: "success" as const,
    note: "Verified match from human-approved patterns",
  },
  T2_synthetic: {
    icon: Cpu, label: "T2 Validated Logic", variant: "primary" as const,
    note: "Pattern found in verified RLM memory",
  },
  T3_llm: {
    icon: Sparkles, label: "T3 Synthesized", variant: "orange" as const,
    note: "No vault match — reasoning synthesized via RLM",
  },
};

export function FixProposalCard({ fix }: { fix: FixProposal }) {
  const [diffOpen,    setDiffOpen]    = useState(false);

  const [rlmOpen,     setRlmOpen]     = useState(false);
  const cfg = TIER[fix.tier] ?? TIER.T3_llm;
  const TierIcon = cfg.icon;
  const pct = Math.round(fix.confidence * 100);
  const barColor =
    pct >= 75 ? "bg-green-400" :
    pct >= 50 ? "bg-yellow-400" : "bg-red-400";

  const rlmTrace = fix.rlm_trace ?? [];

  return (
    <div className="border border-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 bg-slate-50/50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Fix Proposal
        </p>
        <Badge variant={cfg.variant} className="gap-1.5 font-bold">
          <TierIcon className="w-3.5 h-3.5" />
          {cfg.label}
        </Badge>
      </div>

      <div className="p-5 space-y-5">
        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {fix.similarity_score != null && (
            <span>
              Similarity{" "}
              <span className="text-foreground font-mono font-medium">
                {(fix.similarity_score * 100).toFixed(1)}%
              </span>
            </span>
          )}
          <span>
            Confidence{" "}
            <span className="text-foreground font-mono font-medium">{pct}%</span>
          </span>
        </div>

        {/* Confidence bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Description */}
        <p className="text-sm text-foreground leading-relaxed">
          {fix.fix_description}
        </p>

        {/* Commands */}
        {fix.fix_commands.length > 0 && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-1.5 font-mono text-[11px] shadow-lg">
            {fix.fix_commands.map((cmd, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-500 select-none">$</span>
                <span className="text-orange-400">{cmd}</span>
              </div>
            ))}
          </div>
        )}

        {/* Diff collapsible */}
        {fix.fix_diff && (
          <div>
            <button
              onClick={() => setDiffOpen(!diffOpen)}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary transition-colors mb-2"
            >
              <div className={cn("w-5 h-5 rounded-full border border-slate-100 flex items-center justify-center transition-transform", diffOpen && "rotate-180")}>
                <ChevronDown className="w-3 h-3" />
              </div>
              VIEW FIX DIFF
            </button>
            {diffOpen && (
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono overflow-x-auto whitespace-pre text-slate-300 shadow-lg">
                {fix.fix_diff}
              </pre>
            )}
          </div>
        )}

        {/* Reasoning (RLM Depth-1 trace text) */}
        {fix.reasoning && (
          <div className="rounded-xl bg-orange-50 border border-orange-100/50 px-4 py-3 text-sm text-slate-600 leading-relaxed italic">
            <span className="font-bold text-orange-600 not-italic mr-1">RLM Reasoning:</span>
            {fix.reasoning}
          </div>
        )}

        {/* RLM trace (Depth-0/1 scan) */}
        {rlmTrace.length > 0 && (
          <div>
            <button
              onClick={() => setRlmOpen(!rlmOpen)}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary transition-colors"
            >
              <div className="w-5 h-5 rounded-full border border-slate-100 flex items-center justify-center">
                <Brain className="w-3 h-3" />
              </div>
              RLM RECURSIVE TRACE ({rlmTrace.length} STEPS)
            </button>
            {rlmOpen && (
              <div className="mt-3 space-y-2 pl-4 border-l-2 border-orange-100">
                {rlmTrace.map((step, i) => (
                  <div key={i} className="rounded-xl bg-white border border-slate-100 p-4 text-[11px] font-medium space-y-1 shadow-sm">
                    <p className="text-orange-500 font-bold uppercase tracking-widest text-[9px]">Depth-{step.depth} Scan</p>
                    <p className="text-slate-400">Hotspot: <span className="text-slate-900">{step.hotspot}</span></p>
                    <p className="text-slate-400">Finding: <span className="text-slate-900 font-bold">{step.finding}</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest pt-2">{cfg.note}</p>
      </div>
    </div>
  );
}
