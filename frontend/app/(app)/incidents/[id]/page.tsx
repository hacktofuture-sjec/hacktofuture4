"use client";

import { use, useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Loader2, AlertCircle, Clock,
  CheckCircle2, XCircle, FileText, GitCommit, Cpu,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAgentStream } from "@/lib/hooks/use-agent-stream";
import { AgentTimeline } from "@/components/agent-timeline";
import { FixProposalCard } from "@/components/fix-proposal-card";
import { RiskGauge } from "@/components/risk-gauge";
import { ApprovalPanel } from "@/components/approval-panel";
import { Badge } from "@/components/ui/badge";
import { SkeletonTimeline } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import type {
  Incident, DiagnosticBundle, FixProposal,
  GovernanceDecision, AgentLog,
} from "@/lib/types";

interface Detail {
  incident:            Incident;
  diagnostic_bundle:   DiagnosticBundle   | null;
  fix_proposal:        FixProposal        | null;
  governance_decision: GovernanceDecision | null;
  agent_logs:          AgentLog[];
}

const STATUS_CONFIG = {
  processing:        { icon: Loader2,      variant: "warning"  as const, label: "Processing",       spin: true,  color: "hsl(38 92% 50%)"  },
  awaiting_approval: { icon: Clock,        variant: "info"     as const, label: "Awaiting Approval", spin: false, color: "hsl(199 89% 54%)" },
  resolved:          { icon: CheckCircle2, variant: "success"  as const, label: "Resolved",          spin: false, color: "hsl(142 69% 42%)" },
  failed:            { icon: XCircle,      variant: "danger"   as const, label: "Failed",            spin: false, color: "hsl(0 72% 51%)"   },
};

function SectionCard({
  title,
  icon: Icon,
  accent,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl overflow-hidden", className)}
      style={{
        border: accent ? `1px solid ${accent}20` : "1px solid hsl(var(--border))",
        background: "hsl(var(--card))",
        boxShadow: accent ? `0 0 24px -8px ${accent}14` : undefined,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: "1px solid hsl(var(--border))",
          background: accent ? `${accent}07` : "hsl(var(--muted) / 0.3)",
        }}
      >
        {Icon && (
          <span style={{ color: accent ?? "hsl(var(--muted-foreground))" }}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        )}
        <p
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: accent ?? "hsl(var(--muted-foreground))" }}
        >
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data,    setData]    = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const { logs, done } = useAgentStream(id);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.getIncident(id);
      setData(result as unknown as Detail);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (done) fetchData(); }, [done, fetchData]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="skeleton h-7 w-52 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4 bg-card">
              <SkeletonTimeline />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" />
          Incident not found.
        </div>
      </div>
    );
  }

  const { incident, diagnostic_bundle: bundle, fix_proposal: fix, governance_decision: gov } = data;
  const allLogs       = logs.length > 0 ? logs : data.agent_logs;
  const needsApproval = incident.status === "awaiting_approval" || gov?.decision === "block_await_human";
  const s = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.processing;
  const StatusIcon = s.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 page-header"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
              Incident{" "}
              <span className="font-mono text-primary">{id.slice(0, 8)}…</span>
            </h1>
            <Badge variant={s.variant} className="gap-1 flex-shrink-0">
              <StatusIcon className={cn("w-3 h-3", s.spin && "animate-spin")} />
              {s.label}
            </Badge>
          </div>

          <p className="text-[11px] text-muted-foreground hidden sm:block">
            {incident.source} · {incident.failure_type} · {timeAgo(incident.created_at)}
          </p>
        </div>
      </div>

      {/* ── 3-col grid ──────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-4 items-start">

          {/* ── Col 1: Agent timeline ─────────────────────────── */}
          <SectionCard
            title="Agent Pipeline"
            icon={Cpu}
            accent="hsl(217 91% 60%)"
          >
            <div className="p-4">
              <AgentTimeline logs={allLogs} done={done} />
            </div>
          </SectionCard>

          {/* ── Col 2: Diagnostic + fix ───────────────────────── */}
          <div className="space-y-4">
            {/* Log excerpt */}
            {bundle?.log_excerpt && (
              <SectionCard title="Log Excerpt" icon={FileText} accent="hsl(0 72% 51%)">
                <pre className="px-4 py-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap"
                  style={{ color: "hsl(0 72% 65%)" }}>
                  {bundle.log_excerpt}
                </pre>
              </SectionCard>
            )}

            {/* Git diff */}
            {bundle?.git_diff && (
              <SectionCard title="Git Diff" icon={GitCommit}>
                <pre className="px-4 py-3.5 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32 overflow-y-auto whitespace-pre leading-relaxed">
                  {bundle.git_diff}
                </pre>
              </SectionCard>
            )}

            {/* Context summary */}
            {bundle?.context_summary && (
              <div
                className="rounded-xl px-4 py-3.5"
                style={{
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--muted) / 0.4)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                  Context Summary
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {bundle.context_summary}
                </p>
              </div>
            )}

            {/* Fix proposal */}
            {fix ? (
              <FixProposalCard fix={fix} />
            ) : (
              <div
                className="rounded-xl p-8 text-center"
                style={{
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
              >
                {incident.status === "processing" ? (
                  <>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: "hsl(217 91% 60% / 0.1)", border: "1px solid hsl(217 91% 60% / 0.2)" }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Searching memory vault…</p>
                    <p className="text-xs text-muted-foreground mt-1">Running tiered retrieval T1 → T2 → T3</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No fix proposal generated</p>
                )}
              </div>
            )}
          </div>

          {/* ── Col 3: Governance + approval ─────────────────── */}
          <div className="space-y-4">
            {gov && <RiskGauge decision={gov} />}

            {needsApproval && (
              <ApprovalPanel incidentId={id} onResolved={fetchData} />
            )}

            {incident.status === "resolved" && !needsApproval && (
              <div
                className="rounded-xl p-5 text-center space-y-2"
                style={{
                  border: "1px solid hsl(142 69% 42% / 0.25)",
                  background: "hsl(142 69% 42% / 0.06)",
                  boxShadow: "0 0 24px -8px hsl(142 69% 42% / 0.2)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "hsl(142 69% 42% / 0.12)", border: "1px solid hsl(142 69% 42% / 0.25)" }}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-emerald-400">Resolved</p>
                <p className="text-xs text-muted-foreground">Vault confidence updated</p>
              </div>
            )}

            {incident.status === "failed" && (
              <div
                className="rounded-xl p-5 text-center space-y-2"
                style={{
                  border: "1px solid hsl(0 72% 51% / 0.25)",
                  background: "hsl(0 72% 51% / 0.06)",
                  boxShadow: "0 0 24px -8px hsl(0 72% 51% / 0.15)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "hsl(0 72% 51% / 0.12)", border: "1px solid hsl(0 72% 51% / 0.25)" }}
                >
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-sm font-bold text-red-400">Failed / Rejected</p>
                <p className="text-xs text-muted-foreground">Vault confidence decayed</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
