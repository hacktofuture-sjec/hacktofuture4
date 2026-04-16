"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Play, AlertCircle, RefreshCw,
  Activity, CheckCircle2, Database, TrendingUp,
  Server, Cpu, TestTube, Shield, Container, Radio,
  Zap, Terminal,
} from "lucide-react";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { IncidentCard } from "@/components/incident-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SCENARIOS = [
  {
    id: "postgres_refused",
    label: "Postgres Refused",
    type: "infra",
    icon: Server,
    color: "text-amber-400",
    accent: "hsl(38 92% 50%)",
    desc: "Connection refused on port 5432",
  },
  {
    id: "oom_kill",
    label: "OOM Kill",
    type: "oom",
    icon: Cpu,
    color: "text-red-400",
    accent: "hsl(0 72% 51%)",
    desc: "Container killed, exit code 137",
  },
  {
    id: "test_failure",
    label: "Test Failure",
    type: "test",
    icon: TestTube,
    color: "text-blue-400",
    accent: "hsl(217 91% 60%)",
    desc: "3 assertions failed in test suite",
  },
  {
    id: "secret_leak",
    label: "Secret Leak",
    type: "security",
    icon: Shield,
    color: "text-rose-400",
    accent: "hsl(346 77% 50%)",
    desc: "API key detected in commit diff",
  },
  {
    id: "image_pull_backoff",
    label: "Image Pull Backoff",
    type: "deploy",
    icon: Container,
    color: "text-sky-400",
    accent: "hsl(199 89% 54%)",
    desc: "ImagePullBackOff on registry pull",
  },
];

export default function DashboardPage() {
  const { incidents, loading, error, refetch } = useIncidents(4000);
  const [simulating, setSimulating] = useState<string | null>(null);
  const router = useRouter();

  async function simulate(scenario: string) {
    setSimulating(scenario);
    try {
      const result = await api.simulate(scenario);
      refetch();
      router.push(`/incidents/${result.incident_id}`);
    } catch {
      // silently fail
    } finally {
      setSimulating(null);
    }
  }

  const activeCount   = incidents.filter(i => i.status === "processing" || i.status === "awaiting_approval").length;
  const resolvedCount = incidents.filter(i => i.status === "resolved").length;
  const failedCount   = incidents.filter(i => i.status === "failed").length;
  const successRate   = incidents.length > 0 ? Math.round(resolvedCount / incidents.length * 100) : 0;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky header ───────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 page-header"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: "hsl(217 91% 60% / 0.1)",
                border: "1px solid hsl(217 91% 60% / 0.22)",
                boxShadow: "0 0 14px -3px hsl(217 91% 60% / 0.2)",
              }}
            >
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
                Live Dashboard
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Real-time CI/CD failure detection &amp; repair
              </p>
            </div>
          </div>
          <button
            onClick={refetch}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
              "text-xs font-medium text-muted-foreground",
              "border border-transparent hover:border-border hover:text-foreground hover:bg-muted",
              "transition-all duration-150"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Incidents"
            value={incidents.length}
            icon={<Activity className="w-4 h-4" />}
            accent="hsl(217 91% 60%)"
          />
          <StatCard
            label="Active Now"
            value={activeCount}
            sub={activeCount > 0 ? "In pipeline…" : "All clear"}
            trend={activeCount > 0 ? "up" : "neutral"}
            icon={<Zap className="w-4 h-4" />}
            accent="hsl(38 92% 50%)"
          />
          <StatCard
            label="Resolved"
            value={resolvedCount}
            sub={incidents.length > 0 ? `${successRate}% success rate` : undefined}
            trend="up"
            icon={<CheckCircle2 className="w-4 h-4" />}
            accent="hsl(142 69% 42%)"
          />
          <StatCard
            label="Failed"
            value={failedCount}
            icon={<TrendingUp className="w-4 h-4" />}
            accent="hsl(0 72% 51%)"
          />
        </div>

        {/* ── Failure Simulator ───────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: "1px solid hsl(262 83% 65% / 0.2)",
            background: "hsl(262 40% 8% / 0.6)",
            boxShadow: "0 0 40px -12px hsl(262 83% 65% / 0.12)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: "1px solid hsl(262 83% 65% / 0.14)" }}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{
                background: "hsl(262 83% 65% / 0.12)",
                border: "1px solid hsl(262 83% 65% / 0.24)",
              }}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Failure Simulator</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Inject a real-looking CI/CD incident to demo the repair pipeline
              </p>
            </div>
            <div
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{
                background: "hsl(262 83% 65% / 0.1)",
                border: "1px solid hsl(262 83% 65% / 0.2)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">
                Demo Mode
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
              {SCENARIOS.map((s) => {
                const busy = simulating === s.id;
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => simulate(s.id)}
                    disabled={!!simulating}
                    className="group relative flex flex-col gap-2.5 p-4 rounded-xl text-left transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: `${s.accent}09`,
                      border: `1px solid ${s.accent}20`,
                    }}
                    onMouseEnter={(e) => {
                      if (!simulating) {
                        (e.currentTarget as HTMLElement).style.background = `${s.accent}16`;
                        (e.currentTarget as HTMLElement).style.borderColor = `${s.accent}38`;
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px -6px ${s.accent}28`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `${s.accent}09`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${s.accent}20`;
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{
                        background: busy ? "hsl(var(--muted))" : `${s.accent}18`,
                        border: `1px solid ${s.accent}28`,
                      }}
                    >
                      {busy
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : <Icon className={cn("w-4 h-4", s.color)} />
                      }
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground leading-snug">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {s.desc}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          color: s.accent,
                          background: `${s.accent}18`,
                        }}
                      >
                        {s.type}
                      </span>
                      {!simulating && (
                        <Play
                          className="w-3 h-3 opacity-30 group-hover:opacity-70 transition-opacity"
                          style={{ color: s.accent }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Incidents ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                Recent Incidents
              </h2>
              {incidents.length > 0 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {incidents.length}
                </span>
              )}
            </div>
            {loading && incidents.length > 0 && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {error && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl text-sm text-red-400"
              style={{
                border: "1px solid hsl(0 72% 51% / 0.2)",
                background: "hsl(0 72% 51% / 0.06)",
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error} — is the backend running?</span>
            </div>
          )}

          {loading && !incidents.length ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : incidents.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-xl text-center"
              style={{
                border: "1px dashed hsl(var(--border))",
                background: "hsl(var(--muted) / 0.3)",
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: "hsl(var(--muted))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Radio className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No incidents yet</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                Fire a scenario above to watch the REKALL pipeline animate in real-time
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc, i) => (
                <div
                  key={inc.id}
                  className="fade-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <IncidentCard incident={inc} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
