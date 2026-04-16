"use client";

import Link from "next/link";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, Clock, Server, TestTube, Shield, Cpu, Container,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";
import type { Incident } from "@/lib/types";

const STATUS_CONFIG = {
  processing:        { icon: Loader2,       label: "Processing",   color: "text-amber-500",  bg: "bg-amber-500/10",   spin: true,  variant: "warning" as const },
  awaiting_approval: { icon: AlertTriangle, label: "Needs Review", color: "text-purple-500", bg: "bg-purple-500/10",  spin: false, variant: "purple"  as const },
  resolved:          { icon: CheckCircle2,  label: "Resolved",     color: "text-emerald-500",bg: "bg-emerald-500/10", spin: false, variant: "success" as const },
  failed:            { icon: XCircle,       label: "Failed",       color: "text-red-500",    bg: "bg-red-500/10",     spin: false, variant: "danger"  as const },
};

const FAILURE_CONFIG = {
  test:     { icon: TestTube,      label: "Test",     variant: "primary" as const },
  deploy:   { icon: Container,     label: "Deploy",   variant: "info"    as const },
  infra:    { icon: Server,        label: "Infra",    variant: "warning" as const },
  security: { icon: Shield,        label: "Security", variant: "danger"  as const },
  oom:      { icon: Cpu,           label: "OOM",      variant: "orange"  as const },
  unknown:  { icon: AlertTriangle, label: "Unknown",  variant: "muted"   as const },
};

export function IncidentCard({ incident }: { incident: Incident }) {
  const sc = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.processing;
  const fc = FAILURE_CONFIG[incident.failure_type as keyof typeof FAILURE_CONFIG] ?? FAILURE_CONFIG.unknown;
  const StatusIcon = sc.icon;
  const FailureIcon = fc.icon;
  const desc = (incident.raw_payload as Record<string, string>)?.description ?? "Pipeline failure detected";

  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="group flex items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-100 active:scale-[0.99]"
    >
      {/* Status icon */}
      <div className={cn("flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl", sc.bg)}>
        <StatusIcon className={cn("w-5 h-5", sc.color, sc.spin && "animate-spin")} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={fc.variant}>
            <FailureIcon className="w-3 h-3" />
            {fc.label}
          </Badge>
          <Badge variant="muted" className="font-bold opacity-80">{incident.source}</Badge>
          {incident.status === "processing" && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 text-[9px] font-black text-orange-600 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Live Pulse
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-800 truncate">{desc}</p>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(incident.created_at)}</span>
          </div>
          <span className="opacity-20">|</span>
          <span className="font-mono text-[10px] uppercase opacity-60 tracking-wider">ID-{incident.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 flex flex-col items-end justify-between self-stretch py-0.5">
        <Badge variant={sc.variant} dot className="font-bold uppercase tracking-widest text-[10px]">{sc.label}</Badge>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary transition-all group-hover:border-primary">
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-white" />
        </div>
      </div>
    </Link>
  );
}
