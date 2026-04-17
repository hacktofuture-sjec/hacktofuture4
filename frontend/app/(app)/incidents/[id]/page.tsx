"use client";

import { use, useEffect, useState, useCallback } from "react";
import { ArrowLeft, Loader2, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAgentStream } from "@/lib/hooks/use-agent-stream";
import { AgentTimeline } from "@/components/agent-timeline";
import { FixProposalCard } from "@/components/fix-proposal-card";
import { RiskGauge } from "@/components/risk-gauge";
import { ApprovalPanel } from "@/components/approval-panel";
import { SandboxResultCard } from "@/components/sandbox-result-card";
import { Badge } from "@/components/ui/badge";
import { SkeletonTimeline } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import type {
  Incident, DiagnosticBundle, FixProposal,
  GovernanceDecision, AgentLog, SandboxResult,
} from "@/lib/types";

interface Detail {
  incident:           Incident;
  diagnostic_bundle:  DiagnosticBundle | null;
  fix_proposal:       FixProposal      | null;
  governance_decision: GovernanceDecision | null;
  sandbox_result:     SandboxResult    | null;
  agent_logs:         AgentLog[];
}

const STATUS_CONFIG = {
  processing:        { icon: Loader2,      variant: "warning"  as const, label: "Processing",        spin: true  },
  awaiting_approval: { icon: Clock,        variant: "primary"  as const, label: "Needs Review",      spin: false },
  resolved:          { icon: CheckCircle2, variant: "success"  as const, label: "Resolved",           spin: false },
  failed:            { icon: XCircle,      variant: "danger"   as const, label: "Failed / Rejected",  spin: false },
};

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data,    setData]    = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const { logs, done, sandboxResult: liveSandbox, status: liveStatus } = useAgentStream(id);

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
  useEffect(() => { if (liveStatus) fetchData(); }, [liveStatus, fetchData]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="skeleton h-6 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4 bg-card">
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

  const { incident, diagnostic_bundle: bundle, fix_proposal: fix, governance_decision: gov, sandbox_result: storedSandbox } = data;
  // Prefer live SSE sandbox_result over stored value (shows in real time)
  const sandbox = liveSandbox ?? storedSandbox;
  const allLogs       = logs.length > 0 ? logs : data.agent_logs;
  const needsApproval = incident.status === "awaiting_approval"
    || gov?.decision === "block_await_human";
  const s = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.processing;
  const StatusIcon = s.icon;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-5">
          <Link
            href="/dashboard"
            className="mt-1 p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Incident <span className="text-primary tracking-tighter">ID-{id.slice(0, 8).toUpperCase()}</span>
              </h1>
              <Badge variant={s.variant} className="gap-1.5 font-bold uppercase tracking-widest px-3 py-1 text-[10px]">
                <StatusIcon className={cn("w-3 h-3", s.spin && "animate-spin")} />
                {s.label}
              </Badge>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {incident.source} · {incident.failure_type} · {timeAgo(incident.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-4 items-start">
        {/* Col 1: Agent timeline */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agent Pipeline
            </p>
          </div>
          <div className="p-4">
            <AgentTimeline logs={allLogs} done={done} />
          </div>
        </div>

        {/* Col 2: Context + fix */}
        <div className="space-y-4">
          {/* Log excerpt */}
          {bundle?.log_excerpt && (
            <div className="border border-slate-100 rounded-2xl bg-slate-900 shadow-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Log Excerpt
                </p>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400/50" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/50" />
                  <span className="w-2 h-2 rounded-full bg-green-400/50" />
                </div>
              </div>
              <pre className="px-5 py-4 text-[11px] font-mono text-red-300/90 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {bundle.log_excerpt}
              </pre>
            </div>
          )}

          {/* Git diff */}
          {bundle?.git_diff && (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Git Diff
                </p>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono overflow-x-auto max-h-28 overflow-y-auto whitespace-pre text-muted-foreground leading-relaxed">
                {bundle.git_diff}
              </pre>
            </div>
          )}

          {/* Context summary */}
          {bundle?.context_summary && (
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">
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
            <div className="border border-border rounded-lg p-6 bg-card text-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {incident.status === "processing"
                  ? "Searching memory vault…"
                  : "No fix proposal generated"}
              </p>
            </div>
          )}

          {/* Sandbox validation result */}
          {sandbox && <SandboxResultCard result={sandbox} />}
        </div>

        {/* Col 3: Governance + approval */}
        <div className="space-y-4">
          {gov && <RiskGauge decision={gov} />}

          {needsApproval && (
            <ApprovalPanel incidentId={id} onResolved={fetchData} />
          )}

          {incident.status === "resolved" && !needsApproval && (
            <div className="border border-emerald-100 bg-emerald-50 rounded-2xl p-6 text-center space-y-2 shadow-sm shadow-emerald-500/5">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-black uppercase tracking-tight">Resolved</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Outcome recorded & stakeholders notified.
              </p>
            </div>
          )}

          {incident.status === "failed" && (
            <div className="border border-red-100 bg-red-50 rounded-2xl p-6 text-center space-y-2 shadow-sm shadow-red-500/5">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-red-600 font-black uppercase tracking-tight">Failed / Rejected</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Incident logged & reported.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
