"use client";

import {
  CheckCircle2, Loader2, XCircle,
  Radio, Microscope, Wrench, Scale, Rocket, Brain, Shield, Container, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentLog } from "@/lib/types";

const STEPS = [
  { key: "monitor",      label: "Monitor",     sub: "Detect & normalise event",      icon: Radio },
  { key: "diagnostic",   label: "Diagnostic",  sub: "Fetch logs, diff, tests",       icon: Microscope },
  { key: "fix",          label: "Fix",         sub: "Search vault T1 → T2 → T3",    icon: Wrench },
  { key: "simulation",   label: "Simulation",  sub: "Counterfactual dry-run",        icon: Rocket },
  { key: "governance",   label: "Governance",  sub: "Score risk, decide action",     icon: Scale },
  { key: "publish_guard",label: "Publish",     sub: "Supply chain gate",             icon: Shield },
  { key: "sandbox",      label: "Sandbox",     sub: "Minikube validation",           icon: Container },
  { key: "execute",      label: "Execute",     sub: "Apply fix / open PR",           icon: Play },
  { key: "learning",     label: "Learning",    sub: "Update vault confidence",       icon: Brain },
];

interface Props {
  logs: AgentLog[];
  done: boolean;
}

export function AgentTimeline({ logs, done }: Props) {
  const statusMap = new Map<string, { status: string; detail: string }>();
  for (const log of logs) {
    statusMap.set(log.step_name, { status: log.status, detail: log.detail });
  }

  return (
    <div className="space-y-1">
      {STEPS.map(({ key, label, sub, icon: StepIcon }, idx) => {
        const entry  = statusMap.get(key);
        const status = entry?.status ?? "pending";
        const detail = entry?.detail;
        const isLast = idx === STEPS.length - 1;

        const isDone    = status === "done";
        const isRunning = status === "running";
        const isError   = status === "error";

        return (
          <div key={key} className="flex gap-3">
            {/* Track column */}
            <div className="flex flex-col items-center">
              {/* Step node */}
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-lg border flex-shrink-0 transition-all",
                isDone    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                isRunning ? "bg-amber-500/10 border-amber-500/30 text-amber-500 step-running" :
                isError   ? "bg-red-500/10 border-red-500/30 text-red-500" :
                "bg-muted/50 border-border text-muted-foreground/40"
              )}>
                {isDone    ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                 isError   ? <XCircle className="w-3.5 h-3.5" /> :
                 <StepIcon className="w-3.5 h-3.5" />}
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={cn(
                  "w-px my-1 flex-1 transition-colors",
                  isDone ? "bg-emerald-500/25" : "bg-border/60"
                )} style={{ minHeight: 16 }} />
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-2 flex-1 min-w-0 pt-1", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isDone    ? "text-foreground" :
                  isRunning ? "text-amber-500" :
                  isError   ? "text-red-500"   :
                  "text-muted-foreground/60"
                )}>
                  {label}
                </span>
                {isRunning && (
                  <span className="text-[10px] text-amber-500 font-bold tracking-widest">RUNNING</span>
                )}
                {isDone && (
                  <span className="text-[10px] text-emerald-500 font-medium tracking-wide">DONE</span>
                )}
              </div>
              {(status === "pending" || !detail) && (
                <p className="text-xs text-muted-foreground/50 mt-0.5">{sub}</p>
              )}
              {detail && status !== "pending" && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate leading-relaxed">{detail}</p>
              )}
            </div>
          </div>
        );
      })}

      {done && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Pipeline completed successfully</span>
        </div>
      )}
    </div>
  );
}
