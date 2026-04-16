"use client";

import {
  CheckCircle2, Loader2, XCircle,
  Radio, Microscope, Wrench, Scale, Rocket, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentLog } from "@/lib/types";

const STEPS = [
  { key: "monitor",    label: "Monitor",    sub: "Detect & normalise event",    icon: Radio,       accent: "hsl(38 92% 50%)"   },
  { key: "diagnostic", label: "Diagnostic", sub: "Fetch logs, diff, tests",     icon: Microscope,  accent: "hsl(217 91% 60%)"  },
  { key: "fix",        label: "Fix",        sub: "Search vault T1 → T2 → T3",  icon: Wrench,      accent: "hsl(142 69% 42%)"  },
  { key: "governance", label: "Governance", sub: "Score risk, decide action",   icon: Scale,       accent: "hsl(262 83% 65%)"  },
  { key: "execute",    label: "Execute",    sub: "Apply fix / open PR",         icon: Rocket,      accent: "hsl(199 89% 54%)"  },
  { key: "learning",   label: "Learning",   sub: "Update vault confidence",     icon: Brain,       accent: "hsl(280 80% 65%)"  },
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
    <div className="space-y-px">
      {STEPS.map(({ key, label, sub, icon: StepIcon, accent }, idx) => {
        const entry     = statusMap.get(key);
        const status    = entry?.status ?? "pending";
        const detail    = entry?.detail;
        const isLast    = idx === STEPS.length - 1;
        const isDone    = status === "done";
        const isRunning = status === "running";
        const isError   = status === "error";
        const isPending = status === "pending";

        const nodeColor  = isDone ? accent : isRunning ? accent : isError ? "hsl(0 72% 51%)" : "hsl(var(--border))";
        const nodeBg     = isDone
          ? `${accent}18`
          : isRunning
          ? `${accent}12`
          : isError
          ? "hsl(0 72% 51% / 0.1)"
          : "hsl(var(--muted) / 0.5)";

        return (
          <div key={key} className="flex gap-3">
            {/* ── Track column ─────────────────────────────── */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Step node */}
              <div
                className={cn(
                  "relative flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all duration-300",
                  isRunning && "step-running"
                )}
                style={{
                  background: nodeBg,
                  border: `1px solid ${isDone || isRunning ? nodeColor : "hsl(var(--border))"}`,
                  boxShadow: (isDone || isRunning) && !isError
                    ? `0 0 12px -3px ${accent}40`
                    : "none",
                }}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent }} />
                ) : isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accent }} />
                ) : isError ? (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <StepIcon
                    className="w-3.5 h-3.5"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
                  />
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="w-px my-1 flex-1 min-h-[14px] transition-all duration-500"
                  style={{
                    background: isDone
                      ? `linear-gradient(180deg, ${accent}50, ${accent}20)`
                      : "hsl(var(--border))",
                  }}
                />
              )}
            </div>

            {/* ── Content ──────────────────────────────────── */}
            <div className={cn("flex-1 min-w-0 pb-2 pt-0.5", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span
                  className={cn("text-sm font-semibold transition-colors leading-none")}
                  style={{
                    color: isDone
                      ? "hsl(var(--foreground))"
                      : isRunning
                      ? accent
                      : isError
                      ? "hsl(0 72% 51%)"
                      : "hsl(var(--muted-foreground))",
                    opacity: isPending ? 0.45 : 1,
                  }}
                >
                  {label}
                </span>

                {isRunning && (
                  <span
                    className="text-[9px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded"
                    style={{
                      color: accent,
                      background: `${accent}18`,
                    }}
                  >
                    running
                  </span>
                )}
                {isDone && (
                  <span
                    className="text-[9px] font-bold tracking-[0.12em] uppercase"
                    style={{ color: accent, opacity: 0.7 }}
                  >
                    ✓
                  </span>
                )}
              </div>

              <p
                className="text-[11px] mt-0.5 leading-snug truncate"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  opacity: isPending ? 0.4 : 0.75,
                }}
              >
                {detail && status !== "pending" ? detail : sub}
              </p>
            </div>
          </div>
        );
      })}

      {done && (
        <div
          className="mt-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg"
          style={{
            background: "hsl(142 69% 42% / 0.08)",
            border: "1px solid hsl(142 69% 42% / 0.22)",
            boxShadow: "0 0 16px -6px hsl(142 69% 42% / 0.25)",
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-400">
            Pipeline completed — vault updated
          </span>
        </div>
      )}
    </div>
  );
}
