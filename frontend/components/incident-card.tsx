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
  processing:        {
    icon: Loader2, label: "Processing", spin: true,
    color: "hsl(38 92% 50%)",
    bg: "hsl(38 92% 50% / 0.08)",
    border: "hsl(38 92% 50% / 0.2)",
    variant: "warning" as const,
    pulse: true,
  },
  awaiting_approval: {
    icon: AlertTriangle, label: "Needs Review", spin: false,
    color: "hsl(262 83% 65%)",
    bg: "hsl(262 83% 65% / 0.08)",
    border: "hsl(262 83% 65% / 0.2)",
    variant: "purple" as const,
    pulse: false,
  },
  resolved:          {
    icon: CheckCircle2, label: "Resolved", spin: false,
    color: "hsl(142 69% 42%)",
    bg: "hsl(142 69% 42% / 0.08)",
    border: "hsl(142 69% 42% / 0.2)",
    variant: "success" as const,
    pulse: false,
  },
  failed:            {
    icon: XCircle, label: "Failed", spin: false,
    color: "hsl(0 72% 51%)",
    bg: "hsl(0 72% 51% / 0.08)",
    border: "hsl(0 72% 51% / 0.2)",
    variant: "danger" as const,
    pulse: false,
  },
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
      className="group relative flex items-start gap-4 p-4 rounded-xl block overflow-hidden transition-all duration-150"
      style={{
        background: "hsl(var(--card))",
        border: `1px solid ${sc.border}`,
        boxShadow: sc.pulse ? `0 0 20px -8px ${sc.color}30` : "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "hsl(var(--card-hover))";
        (e.currentTarget as HTMLElement).style.borderColor = sc.color.replace(")", " / 0.35)");
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "hsl(var(--card))";
        (e.currentTarget as HTMLElement).style.borderColor = sc.border;
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 inset-y-0 w-[3px] rounded-l-xl"
        style={{ background: sc.color, opacity: 0.7 }}
      />

      {/* Status icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl mt-0.5"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        <StatusIcon
          className={cn("w-4 h-4", sc.spin && "animate-spin")}
          style={{ color: sc.color }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1.5 pl-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={fc.variant}>
            <FailureIcon className="w-3 h-3" />
            {fc.label}
          </Badge>
          <Badge variant="muted">{incident.source}</Badge>
          {incident.status === "processing" && (
            <span
              className="text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
              style={{
                color: sc.color,
                background: sc.bg,
                border: `1px solid ${sc.border}`,
              }}
            >
              ● LIVE
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{desc}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(incident.created_at)}</span>
          <span className="opacity-30">·</span>
          <span className="font-mono text-[10px] opacity-40">{incident.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 flex flex-col items-end justify-between self-stretch py-0.5 gap-2">
        <Badge variant={sc.variant} dot>{sc.label}</Badge>
        <ChevronRight
          className="w-4 h-4 opacity-20 group-hover:opacity-60 transition-opacity"
          style={{ color: sc.color }}
        />
      </div>
    </Link>
  );
}
