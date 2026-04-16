"use client";

import { ShieldCheck, ShieldAlert, ShieldX, Zap, GitPullRequest, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GovernanceDecision } from "@/lib/types";

const RISK_BANDS = [
  { max: 0.30, label: "Low Risk",    color: "#10b981", trackColor: "rgba(16,185,129,0.1)", text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  { max: 0.70, label: "Medium Risk", color: "#f97316", trackColor: "rgba(249,115,22,0.1)",  text: "text-orange-600",    bg: "bg-orange-50 border-orange-100"   },
  { max: 1.00, label: "High Risk",   color: "#ef4444", trackColor: "rgba(239,68,68,0.1)",   text: "text-red-600",        bg: "bg-red-50 border-red-100"       },
];

const DECISION_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  auto_apply:        { label: "Auto-applied",         icon: Zap,           color: "text-emerald-600", bg: "bg-emerald-50" },
  create_pr:         { label: "Pull request opened",  icon: GitPullRequest, color: "text-blue-600",    bg: "bg-blue-50"    },
  block_await_human: { label: "Awaiting human review", icon: Clock,         color: "text-orange-600",  bg: "bg-orange-50"  },
};

function getRiskBand(score: number) {
  return RISK_BANDS.find((b) => score <= b.max) ?? RISK_BANDS[2];
}

export function RiskGauge({ decision }: { decision: GovernanceDecision }) {
  const pct  = Math.round(decision.risk_score * 100);
  const band = getRiskBand(decision.risk_score);
  const dec  = DECISION_CONFIG[decision.decision];
  const DecIcon = dec?.icon ?? Clock;

  const R            = 52;
  const circumference = Math.PI * R;
  const filled        = (pct / 100) * circumference;

  const RiskIcon = pct < 30 ? ShieldCheck : pct < 70 ? ShieldAlert : ShieldX;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <RiskIcon className={cn("w-4 h-4", band.text)} />
        <p className="text-sm font-semibold text-foreground">Risk Assessment</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Gauge arc */}
        <div className="flex justify-center">
          <svg width="140" height="80" viewBox="0 0 140 80">
            <path
              d="M 18 72 A 52 52 0 0 1 122 72"
              fill="none"
              stroke={band.trackColor}
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 18 72 A 52 52 0 0 1 122 72"
              fill="none"
              stroke={band.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }}
            />
            <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800"
              fill={band.color} fontFamily="Inter, system-ui, sans-serif">
              {pct}%
            </text>
          </svg>
        </div>

        {/* Risk level badge */}
        <div className={cn("flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-semibold", band.bg, band.text)}>
          <RiskIcon className="w-4 h-4" />
          {band.label}
        </div>

        {/* Decision */}
        {dec && (
          <div className={cn("flex items-center gap-3 p-4 rounded-2xl border border-transparent shadow-sm", dec.bg)}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm", dec.color)}>
              <DecIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Decision</p>
              <p className={cn("text-sm font-black uppercase tracking-tight", dec.color)}>{dec.label}</p>
            </div>
          </div>
        )}

        {/* Risk factors */}
        {decision.risk_factors.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Risk Factors
            </p>
            <div className="space-y-1.5">
              {decision.risk_factors.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive/70 flex-shrink-0" />
                  <span className="font-mono text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
