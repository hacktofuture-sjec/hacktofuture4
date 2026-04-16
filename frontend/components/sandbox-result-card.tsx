"use client";

import { CheckCircle2, XCircle, Container, Clock, FlaskConical, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SandboxResult } from "@/lib/types";

interface Props {
  result: SandboxResult;
}

export function SandboxResultCard({ result }: Props) {
  const passed = result.passed;

  return (
    <div className={cn(
      "border rounded-2xl overflow-hidden shadow-sm",
      passed
        ? "border-emerald-100 bg-emerald-50 shadow-emerald-500/5"
        : "border-red-100 bg-red-50 shadow-red-500/5"
    )}>
      {/* Header */}
      <div className={cn(
        "px-5 py-3 border-b flex items-center justify-between",
        passed ? "border-emerald-100 bg-emerald-100/50" : "border-red-100 bg-red-100/50"
      )}>
        <div className="flex items-center gap-2">
          <Container className={cn("w-4 h-4", passed ? "text-emerald-600" : "text-red-600")} />
          <span className={cn(
            "text-xs font-black uppercase tracking-widest",
            passed ? "text-emerald-700" : "text-red-700"
          )}>
            Minikube Sandbox
          </span>
          {result.demo_mode && (
            <span className="text-[10px] font-bold text-slate-400 bg-white/60 border border-slate-200 rounded px-1.5 py-0.5 uppercase tracking-widest">
              demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {passed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <XCircle className="w-4 h-4 text-red-500" />}
          <span className={cn(
            "text-xs font-black uppercase tracking-widest",
            passed ? "text-emerald-600" : "text-red-600"
          )}>
            {passed ? "Passed" : "Failed"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3">
        <Stat
          icon={<FlaskConical className="w-3 h-3" />}
          label="Tests"
          value={String(result.test_count)}
          color={passed ? "emerald" : "slate"}
        />
        <Stat
          icon={<XCircle className="w-3 h-3" />}
          label="Failures"
          value={String(result.failure_count)}
          color={result.failure_count > 0 ? "red" : "emerald"}
        />
        <Stat
          icon={<Clock className="w-3 h-3" />}
          label="Duration"
          value={`${result.duration_seconds.toFixed(1)}s`}
          color="slate"
        />
      </div>

      {/* Namespace */}
      {result.namespace && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Cpu className="w-3 h-3 flex-shrink-0" />
            <code className="font-mono">{result.namespace}</code>
            {result.valkey_deployed && (
              <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-bold uppercase tracking-widest">
                Valkey ✓
              </span>
            )}
          </div>
        </div>
      )}

      {/* Test log preview */}
      {result.test_log && (
        <div className="border-t border-slate-100 mx-0">
          <details className="group">
            <summary className={cn(
              "px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest cursor-pointer",
              "flex items-center justify-between select-none",
              passed ? "text-emerald-700 hover:text-emerald-800" : "text-red-700 hover:text-red-800"
            )}>
              Test output
              <span className="text-muted-foreground font-normal normal-case tracking-normal group-open:hidden">
                click to expand
              </span>
            </summary>
            <pre className={cn(
              "px-5 pb-4 text-[10px] font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed",
              passed ? "text-emerald-800/80" : "text-red-800/80"
            )}>
              {result.test_log}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "red" | "slate";
}) {
  const colorMap = {
    emerald: "text-emerald-600",
    red:     "text-red-600",
    slate:   "text-slate-600",
  };
  return (
    <div className="flex flex-col items-center gap-0.5 bg-white/60 rounded-xl p-2 border border-white/80">
      <div className={cn("flex items-center gap-1", colorMap[color])}>
        {icon}
        <span className="text-sm font-black">{value}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}
