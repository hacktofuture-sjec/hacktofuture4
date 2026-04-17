"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, Zap, Brain, GitBranch, Shield,
  ChevronRight, Terminal, Check, Activity,
  Database, BarChart3, Cpu, Bell, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Animated terminal lines ────────────────────────────────────────────────

const TERMINAL_LINES = [
  { delay: 0,    color: "text-muted-foreground", text: "$ rekall watch --env production" },
  { delay: 600,  color: "text-yellow-500",        text: "[monitor]    failure detected — github_actions / api_test" },
  { delay: 1200, color: "text-orange-500",          text: "[diagnostic] fetching 4,312 lines of build logs..." },
  { delay: 1800, color: "text-orange-500",          text: "[diagnostic] recursive scan: jest_assertion_error at L492" },
  { delay: 2400, color: "text-orange-600",        text: "[fix]        vault retrieval: T1 miss. T2 hit!" },
  { delay: 3000, color: "text-orange-600",        text: "[fix]        RLM reasoning verified. confidence: 0.94" },
  { delay: 3600, color: "text-orange-700",        text: "[governance] risk_score: 0.12 → decision: auto_apply" },
  { delay: 4200, color: "text-emerald-500",       text: "[execute]    fix applied. monitoring health..." },
  { delay: 4800, color: "text-blue-500",          text: "[reporting]  Slack & Notion notified. outcome: success" },
  { delay: 5200, color: "text-muted-foreground",  text: "─────────────────────────────────────────────────────" },
  { delay: 5600, color: "text-emerald-600",       text: "✓  incident resolved in 14.8s" },
];

function AnimatedTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => setVisibleCount(i + 1), line.delay)
    );
    const cursorTimer = setInterval(() => setCursor((c) => !c), 500);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(cursorTimer);
    };
  }, []);

  return (
    <div className="terminal rounded-xl overflow-hidden border border-border bg-white shadow-xl">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">rekall — real_time</span>
      </div>
      <div className="p-5 space-y-1.5 min-h-[300px] bg-slate-50/50">
        {TERMINAL_LINES.slice(0, visibleCount).map((line, i) => (
          <p
            key={i}
            className={cn("font-mono text-xs leading-relaxed fade-in", line.color)}
          >
            {line.text}
          </p>
        ))}
        {visibleCount < TERMINAL_LINES.length && (
          <span className={cn("inline-block w-2 h-4 bg-primary align-middle", cursor ? "opacity-100" : "opacity-0")} />
        )}
      </div>
    </div>
  );
}

// ── How it works steps ─────────────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    icon: Activity,
    title: "Failure detection",
    description:
      "REKALL listens to GitHub, GitLab, and custom CI webhooks. The moment a workflow fails, it intercepts the logs and triggers a diagnostic event.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    number: "02",
    icon: Cpu,
    title: "RLM Recursive Diagnosis",
    description:
      "Unlike basic LLM tools, Recursive Language Models (RLM) scan massive logs in multiple passes to find the real root cause, regardless of log length.",
    color: "text-orange-600",
    bg: "bg-orange-600/10",
    border: "border-orange-600/20",
  },
  {
    number: "03",
    icon: Database,
    title: "Institutional Memory Vault",
    description:
      "Battle-tested fixes are retrieved from a tiered JSON vault. REKALL prioritizes human-approved patterns (T1) before attempting synthesis.",
    color: "text-orange-700",
    bg: "bg-orange-700/10",
    border: "border-orange-700/20",
  },
  {
    number: "04",
    icon: Shield,
    title: "Governance Safety-Gate",
    description:
      "Every fix is scored across nine risk dimensions. High-risk actions are blocked for human review, while safe fixes are auto-applied.",
    color: "text-orange-800",
    bg: "bg-orange-800/10",
    border: "border-orange-800/20",
  },
  {
    number: "05",
    icon: MessageSquare,
    title: "Integrations & Reporting",
    description:
      "Upon resolution, REKALL logs all reasoning to Notion and notifies stakeholders via Slack, ensuring full auditability of every automated repair.",
    color: "text-blue-600",
    bg: "bg-blue-600/10",
    border: "border-blue-600/20",
  },
];

// ── Feature grid ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    title: "Memory-Driven",
    description: "REKALL grows an institutional memory of your pipeline failures, ensuring the same bug never requires manual effort twice.",
    accent: "text-orange-500",
  },
  {
    icon: Cpu,
    title: "RLM Architecture",
    description: "Recursive analysis handles 10M+ token contexts by shifting from traditional attention windows to a programmable environment.",
    accent: "text-orange-600",
  },
  {
    icon: Shield,
    title: "Gated Governance",
    description: "Multi-layered risk scoring ensures automation only happens when confidence is absolute. Built for safety-critical infra.",
    accent: "text-orange-700",
  },
  {
    icon: Bell,
    title: "Slack Notifications",
    description: "Rich Block Kit notifications keep your team informed of every diagnosis, risk score, and automated intervention.",
    accent: "text-orange-500",
  },
  {
    icon: Database,
    title: "Notion Auditing",
    description: "Automatic post-mortem generation and logging. Every incident is recorded in your project workspace for team visibility.",
    accent: "text-blue-500",
  },
  {
    icon: GitBranch,
    title: "Automated PRs",
    description: "If a fix needs review, REKALL opens a complete Pull Request with code changes, diagnostic traces, and test results.",
    accent: "text-orange-600",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-sm shadow-orange-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">REKALL</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 bg-[radial-gradient(50%_50%_at_50%_0%,rgba(249,115,22,0.08)_0,rgba(255,255,255,0)_100%)]" />
        
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_480px] gap-16 items-center">
            
            {/* Left — Copy */}
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                State-of-the-Art CI/CD Diagnosis
              </div>

              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-slate-900 mb-8">
                Your pipeline broke.
                <br />
                <span className="gradient-text">REKALL remembers the fix.</span>
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed mb-10 max-w-xl">
                The world&apos;s first memory-driven agentic repair system. 
                Using Recursive Language Models (RLM) to diagnose complex 
                CI/CD failures and apply battle-tested fixes in seconds.
              </p>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-primary text-white text-base font-bold hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/25 active:scale-95"
                >
                  Start Now
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-slate-100 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  The RLM Architecture
                </a>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-6 items-center opacity-60">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">LLM-Agnostic</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Memory-Driven</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Governance-Gated</span>
                </div>
              </div>
            </div>

            {/* Right — Animated Terminal */}
            <div className="hidden lg:block fade-up" style={{ animationDelay: "0.2s" }}>
              <AnimatedTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { val: "14s", lab: "avg. recovery time" },
              { val: "10M+", lab: "RLM token context" },
              { val: "24/7", lab: "continuous watch" },
              { val: "0.0s", lab: "human effort required" },
            ].map((s) => (
              <div key={s.lab} className="text-center group">
                <p className="text-4xl font-extrabold text-slate-900 mb-1 tracking-tight group-hover:text-primary transition-colors">{s.val}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{s.lab}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-32">
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <h2 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight mb-6">
            Five Intelligent Agents.
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed font-medium">
            Building institutional memory requires more than a simple prompt. 
            REKALL orchestrates a specialised agent team through a state-machine architecture.
          </p>
        </div>

        <div className="grid gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={cn(
                "group relative flex flex-col md:flex-row gap-8 p-10 rounded-2xl border transition-all hover:bg-white hover:shadow-2xl hover:shadow-orange-500/5",
                "bg-slate-50 border-slate-100",
                "hover:-translate-y-1"
              )}
            >
              <div className={cn(
                "flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-2xl border-2",
                step.bg, step.border
              )}>
                <step.icon className={cn("w-8 h-8", step.color)} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                    {step.number}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-slate-600 leading-relaxed max-w-2xl font-medium">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities ────────────────────────────────────────────── */}
      <section id="features" className="bg-slate-900 py-32 overflow-hidden relative">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="mb-20">
            <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tight mb-6">
              Architecture Built For Scale.
            </h2>
            <p className="text-lg text-slate-400 max-w-xl font-medium">
              Every layer of the REKALL stack is designed to ensure fixes are applied safely and recorded permanently.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
              >
                <f.icon className={cn("w-10 h-10 mb-6 transition-transform group-hover:scale-110", f.accent)} />
                <h3 className="text-xl font-bold text-white mb-4">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm font-black tracking-widest text-slate-900 uppercase">REKALL</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Memory-Driven Agentic CI/CD · 2026
          </p>
          <div className="flex gap-8">
            <Link href="/dashboard" className="text-xs font-black text-slate-900 hover:text-primary transition-colors uppercase tracking-widest">Dashboard</Link>
            <Link href="/vault" className="text-xs font-black text-slate-900 hover:text-primary transition-colors uppercase tracking-widest">Vault</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
