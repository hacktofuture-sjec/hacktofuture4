"use client";

import { ShieldCheck, ShieldAlert, ShieldX, Zap, GitPullRequest, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GovernanceDecision } from "@/lib/types";

interface RiskBand {
  max:        number;
  label:      string;
  color:      string;
  trackColor: string;
  text:       string;
  glow:       string;
}

const RISK_BANDS: RiskBand[] = [
  {
    max: 0.30,
    label: "Low Risk",
    color: "#22c55e",
    trackColor: "hsl(142 69% 42% / 0.15)",
    text: "text-emerald-400",
    glow: "hsl(142 69% 42%)",
  },
  {
    max: 0.70,
    label: "Medium Risk",
    color: "#f59e0b",
    trackColor: "hsl(38 92% 50% / 0.15)",
    text: "text-amber-400",
    glow: "hsl(38 92% 50%)",
  },
  {
    max: 1.00,
    label: "High Risk",
    color: "#ef4444",
    trackColor: "hsl(0 72% 51% / 0.15)",
    text: "text-red-400",
    glow: "hsl(0 72% 51%)",
  },
];

const DECISION_CONFIG: Record<string, { label: string; sub: string; icon: typeof Zap; color: string; bg: string }> = {
  auto_apply:        {
    label: "Auto-applied",
    sub: "Low risk — applied immediately",
    icon: Zap,
    color: "text-emerald-400",
    bg: "hsl(142 69% 42% / 0.08)",
  },
  create_pr:         {
    label: "Pull Request Opened",
    sub: "Medium risk — PR for review",
    icon: GitPullRequest,
    color: "text-blue-400",
    bg: "hsl(217 91% 60% / 0.08)",
  },
  block_await_human: {
    label: "Awaiting Human Review",
    sub: "High risk — manual approval required",
    icon: Clock,
    color: "text-purple-400",
    bg: "hsl(262 83% 65% / 0.08)",
  },
};

function getRiskBand(score: number): RiskBand {
  return RISK_BANDS.find((b) => score <= b.max) ?? RISK_BANDS[2];
}

export function RiskGauge({ decision }: { decision: GovernanceDecision }) {
  const pct       = Math.round(decision.risk_score * 100);
  const band      = getRiskBand(decision.risk_score);
  const dec       = DECISION_CONFIG[decision.decision];
  const DecIcon   = dec?.icon ?? Clock;
  const RiskIcon  = pct < 30 ? ShieldCheck : pct < 70 ? ShieldAlert : ShieldX;

  /* SVG arc — semicircle */
  const R            = 52;
  const circumference = Math.PI * R;
  const filled        = (pct / 100) * circumference;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${band.glow}28`,
        background: "hsl(var(--card))",
        boxShadow: `0 0 30px -10px ${band.glow}20`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{
          borderBottom: "1px solid hsl(var(--border))",
          background: `${band.glow}08`,
        }}
      >
        <RiskIcon className={cn("w-4 h-4", band.text)} />
        <p className="text-xs font-bold text-foreground uppercase tracking-[0.08em]">
          Risk Assessment
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Gauge SVG */}
        <div className="flex flex-col items-center gap-1">
          <svg width="148" height="84" viewBox="0 0 148 84">
            {/* Track */}
            <path
              d="M 22 76 A 52 52 0 0 1 126 76"
              fill="none"
              stroke={band.trackColor}
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Fill */}
            <path
              d="M 22 76 A 52 52 0 0 1 126 76"
              fill="none"
              stroke={band.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${band.color}80)` }}
            />
            {/* Score */}
            <text
              x="74" y="68"
              textAnchor="middle"
              fontSize="24"
              fontWeight="800"
              fill={band.color}
              fontFamily="Inter, system-ui, sans-serif"
              style={{ filter: `drop-shadow(0 0 8px ${band.color}60)` }}
            >
              {pct}%
            </text>
          </svg>

          {/* Risk label */}
          <div
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold")}
            style={{
              background: `${band.glow}14`,
              border: `1px solid ${band.glow}30`,
              color: band.color,
              boxShadow: `0 0 12px -4px ${band.glow}30`,
            }}
          >
            <RiskIcon className="w-3.5 h-3.5" />
            {band.label}
          </div>
        </div>

        {/* Decision box */}
        {dec && (
          <div
            className="rounded-lg p-3.5"
            style={{
              background: dec.bg,
              border: "1px solid hsl(var(--border))",
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
              Decision
            </p>
            <div className="flex items-center gap-2">
              <DecIcon className={cn("w-4 h-4 flex-shrink-0", dec.color)} />
              <div>
                <p className={cn("text-sm font-bold leading-none", dec.color)}>{dec.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{dec.sub}</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk factors */}
        {decision.risk_factors.length > 0 && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{
              background: "hsl(var(--muted) / 0.4)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Risk Factors
            </p>
            <div className="space-y-1.5">
              {decision.risk_factors.map((f) => (
                <div key={f} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: band.color }}
                  />
                  <span className="font-mono text-muted-foreground leading-relaxed">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
