"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, Zap, Brain, GitBranch, Shield,
  ChevronRight, Terminal, Check, Activity,
  Database, BarChart3, Cpu, RefreshCw, GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Animated terminal ──────────────────────────────────────────────────────

const LINES = [
  { delay: 0,    dim: true,  text: "$ rekall watch --env production" },
  { delay: 700,  col: "text-yellow-400",   text: "◆ failure detected — github_actions · test · sample-ci-sad" },
  { delay: 1300, col: "text-sky-400",      text: "  [monitor]    normalised FailureEvent in 12ms" },
  { delay: 1900, col: "text-blue-400",     text: "  [diagnostic] fetching 4,312 lines of build logs..." },
  { delay: 2600, col: "text-blue-400",     text: "  [diagnostic] sig: jest_assertion_M_suffix_missing" },
  { delay: 3200, col: "text-purple-400",   text: "  [fix]        T1 search... miss  T2 search... miss" },
  { delay: 3800, col: "text-purple-400",   text: "  [fix]        → T3 LLM synthesis · confidence 0.87" },
  { delay: 4400, col: "text-orange-400",   text: "  [governance] risk_score 0.42 → create_pr" },
  { delay: 5000, col: "text-emerald-400",  text: "  [execute]    ↗ PR #47 opened · rekall/fix/format-m-suffix" },
  { delay: 5500, col: "text-emerald-400",  text: "  [learning]   vault +entry · confidence 0.65 → 0.80" },
  { delay: 6000, dim: true,  text: "──────────────────────────────────────────────────" },
  { delay: 6300, col: "text-emerald-500",  text: "✓  incident resolved · 18.4s" },
];

function AnimatedTerminal() {
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers = LINES.map((l, i) =>
      setTimeout(() => {
        setCount(i + 1);
        if (i === LINES.length - 1) setDone(true);
      }, l.delay)
    );
    const ct = setInterval(() => setCursor(c => !c), 530);
    return () => { timers.forEach(clearTimeout); clearInterval(ct); };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
      {/* subtle inner glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
      {/* title bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[hsl(224_20%_6%)] border-b border-white/[0.06]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="flex-1 text-center text-[11px] text-white/25 font-mono -ml-12">
          rekall · production
        </span>
      </div>
      {/* body */}
      <div className="bg-[hsl(224_22%_5%)] px-5 py-5 min-h-[300px] space-y-[5px]">
        {LINES.slice(0, count).map((l, i) => (
          <p key={i} className={cn(
            "font-mono text-[12.5px] leading-[1.7] fade-in",
            l.col ?? (l.dim ? "text-white/25" : "text-white/70")
          )}>
            {l.text}
          </p>
        ))}
        {!done && (
          <span className={cn(
            "inline-block w-[7px] h-[14px] bg-primary/80 align-middle rounded-[1px]",
            cursor ? "opacity-100" : "opacity-0"
          )} />
        )}
      </div>
    </div>
  );
}

// ── Pipeline steps ─────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01", icon: Activity, title: "Failure detected",
    body: "REKALL listens to GitHub Actions, GitLab CI, and other webhook sources. The MonitorAgent normalises every failed workflow into a structured FailureEvent within milliseconds.",
    col: "text-yellow-400", bg: "bg-yellow-400/8", border: "border-yellow-400/15",
    glow: "shadow-[0_0_24px_-6px_rgba(250,204,21,0.25)]",
  },
  {
    n: "02", icon: Cpu, title: "RLM Zoom & Scan",
    body: "DiagnosticAgent fetches the full build log — thousands of lines — and runs a two-depth analysis. Depth-0 maps hotspot line ranges. Depth-1 deep-dives into the real root cause, not the red herring at line 3.",
    col: "text-blue-400", bg: "bg-blue-400/8", border: "border-blue-400/15",
    glow: "shadow-[0_0_24px_-6px_rgba(96,165,250,0.25)]",
  },
  {
    n: "03", icon: Database, title: "Tiered vault retrieval",
    body: "FixAgent searches the Memory Vault. Human-approved fixes come first (T1 ≥ 0.85 cosine), then AI-validated ones (T2 ≥ 0.75). Only if both miss does it call the LLM — keeping cost and latency low.",
    col: "text-purple-400", bg: "bg-purple-400/8", border: "border-purple-400/15",
    glow: "shadow-[0_0_24px_-6px_rgba(192,132,252,0.25)]",
  },
  {
    n: "04", icon: Shield, title: "Risk governance",
    body: "GovernanceAgent scores nine risk dimensions: secrets touched, production branch, LLM-generated, infra type, and more. Score < 0.3 → auto-apply. 0.3–0.7 → open PR. > 0.7 → block, wait for human.",
    col: "text-orange-400", bg: "bg-orange-400/8", border: "border-orange-400/15",
    glow: "shadow-[0_0_24px_-6px_rgba(251,146,60,0.25)]",
  },
  {
    n: "05", icon: RefreshCw, title: "Learning loop",
    body: "After every outcome LearningAgent updates vault confidence with a reward signal. Successes compound. Failures decay. The vault grows smarter — not just bigger — with every incident.",
    col: "text-emerald-400", bg: "bg-emerald-400/8", border: "border-emerald-400/15",
    glow: "shadow-[0_0_24px_-6px_rgba(52,211,153,0.25)]",
  },
];

// ── Feature cards ──────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Brain,          title: "Memory Vault",       body: "Human-approved and AI-generated fixes stored as vector embeddings in ChromaDB. The vault grows smarter with every incident resolved.",     accent: "text-purple-400", glow: "group-hover:shadow-[0_0_32px_-8px_rgba(192,132,252,0.3)]" },
  { icon: Cpu,            title: "RLM Zoom & Scan",    body: "Two-depth recursive log analysis. Depth-0 identifies hotspot line ranges across thousands of lines. Depth-1 deep-dives into the root cause.", accent: "text-blue-400",   glow: "group-hover:shadow-[0_0_32px_-8px_rgba(96,165,250,0.3)]"  },
  { icon: Shield,         title: "Risk Governance",    body: "Nine-dimension risk scoring determines auto-apply, PR, or block. No blind auto-fixes. Every decision is auditable and explainable.",         accent: "text-orange-400", glow: "group-hover:shadow-[0_0_32px_-8px_rgba(251,146,60,0.3)]"  },
  { icon: BarChart3,      title: "RL Confidence",      body: "Reward signals update vault confidence after every outcome. Stale fixes decay exponentially at 0.995^days. Proven fixes compound to 1.0.",   accent: "text-emerald-400",glow: "group-hover:shadow-[0_0_32px_-8px_rgba(52,211,153,0.3)]"  },
  { icon: GitPullRequest, title: "Real PR Creation",   body: "When governance decides create_pr, REKALL opens a real GitHub PR with a diff — correct branch, commit message, and description. Zero copy-paste.",  accent: "text-yellow-400", glow: "group-hover:shadow-[0_0_32px_-8px_rgba(250,204,21,0.3)]"  },
  { icon: Activity,       title: "Live SSE Stream",    body: "Every agent step streams to the dashboard via Server-Sent Events. Watch the pipeline animate from detection to resolution in real time.",       accent: "text-rose-400",   glow: "group-hover:shadow-[0_0_32px_-8px_rgba(251,113,133,0.3)]" },
];

// ── Comparison ─────────────────────────────────────────────────────────────

const COMPARE = [
  { feature: "Fix retrieval",   rekall: "Tiered vault  T1 → T2 → T3",         bad: "LLM from scratch every time" },
  { feature: "Memory",          rekall: "Persistent ChromaDB vector vault",    bad: "None — stateless per-run" },
  { feature: "Learning",        rekall: "RL reward signals + temporal decay",  bad: "None" },
  { feature: "Risk scoring",    rekall: "9-dimension, 0–1 continuous score",   bad: "Binary flag or absent" },
  { feature: "Log analysis",    rekall: "RLM two-depth Zoom & Scan",           bad: "Last N lines only" },
  { feature: "Human-in-loop",   rekall: "Governance-gated approval panel",     bad: "YOLO or fully manual" },
];

// ── Stack row ──────────────────────────────────────────────────────────────

const STACK = [
  { tech: "Go (Gin)",       desc: "REST API · SSE broker · Postgres · incident lifecycle",     dot: "bg-sky-400"     },
  { tech: "Python FastAPI", desc: "LangGraph orchestrator · 5 agents · vault · RL engine",     dot: "bg-yellow-400"  },
  { tech: "ChromaDB",       desc: "Vector store · ANN similarity search · vault backing",      dot: "bg-purple-400"  },
  { tech: "Groq LLM",       desc: "llama-3.3-70b · diagnosis · fix synthesis · RLM scans",     dot: "bg-emerald-400" },
  { tech: "Next.js 15",     desc: "Real-time dashboard · SSE stream · approval panel",         dot: "bg-blue-400"    },
];


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(224_20%_6%)] text-foreground overflow-x-hidden">

      {/* ── Ambient background ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/[0.045] rounded-full blur-[120px]" />
        <div className="absolute top-[30%] -left-40 w-[500px] h-[500px] bg-purple-600/[0.03] rounded-full blur-[100px]" />
        <div className="absolute top-[50%] -right-40 w-[400px] h-[400px] bg-blue-600/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[hsl(224_20%_6%)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-[54px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">REKALL</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              live
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-0.5">
            {[["How it works", "#how-it-works"], ["Features", "#features"], ["Compare", "#compare"]].map(([label, href]) => (
              <a key={label} href={href}
                className="px-3 py-1.5 rounded-lg text-[12.5px] text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition-all">
                {label}
              </a>
            ))}
          </nav>
          <Link href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-colors shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]">
            Open dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* copy */}
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11.5px] text-white/50 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Memory-driven agentic CI/CD repair
            </div>

            <h1 className="text-[2.9rem] lg:text-[3.5rem] font-bold tracking-[-0.03em] leading-[1.08] mb-5">
              Your pipeline broke.
              <br />
              <span className="bg-gradient-to-r from-[hsl(217_91%_70%)] via-[hsl(250_80%_72%)] to-[hsl(280_75%_68%)] bg-clip-text text-transparent">
                REKALL already knows&nbsp;the&nbsp;fix.
              </span>
            </h1>

            <p className="text-[15px] text-white/50 leading-[1.75] mb-9 max-w-[460px]">
              REKALL watches your CI/CD pipelines, diagnoses failures with two-depth
              log analysis, retrieves battle-tested fixes from a learning vault, and
              opens a real GitHub PR — all in under 20 seconds.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-all shadow-[0_0_28px_-4px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_36px_-4px_hsl(var(--primary)/0.7)]">
                Open dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] text-sm font-medium text-white/60 hover:text-white/90 hover:border-white/20 hover:bg-white/[0.06] transition-all">
                See how it works
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {["LangGraph · 5 agents", "ChromaDB vault", "Groq LLM", "Human-in-loop", "Real PRs"].map(tag => (
                <span key={tag}
                  className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] text-[11px] text-white/35 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* terminal */}
          <div className="fade-up" style={{ animationDelay: "80ms" }}>
            <AnimatedTerminal />
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-white/[0.05]">
          {[
            { val: "18s",   label: "avg time to PR",       sub: "webhook to pull request" },
            { val: "T1→3",  label: "tiered retrieval",     sub: "vault first, LLM last" },
            { val: "0.85",  label: "cosine threshold",     sub: "T1 human vault match" },
            { val: "∞",     label: "vault memory",         sub: "grows with every incident" },
          ].map(s => (
            <div key={s.val} className="text-center px-4">
              <p className="text-[2rem] font-bold tracking-tight bg-gradient-to-b from-white/90 to-white/50 bg-clip-text text-transparent mb-0.5">
                {s.val}
              </p>
              <p className="text-[12.5px] font-semibold text-white/70 mb-0.5">{s.label}</p>
              <p className="text-[11px] text-white/30">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Pipeline</p>
          <h2 className="text-[2rem] font-bold tracking-tight mb-4">
            Five agents. One goal.
          </h2>
          <p className="text-white/45 max-w-lg mx-auto text-[14.5px] leading-relaxed">
            A LangGraph state machine — five specialised agents that hand off context
            sequentially, each with a single responsibility and a clear output.
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className={cn(
                "group flex gap-5 p-5 rounded-2xl border transition-all duration-200 cursor-default",
                s.border, s.bg,
                "hover:border-opacity-40",
                s.glow,
              )}>
                <div className={cn(
                  "flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border",
                  s.border, s.bg
                )}>
                  <s.icon className={cn("w-5 h-5", s.col)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] font-mono font-semibold text-white/20 tracking-[0.15em]">{s.n}</span>
                    <h3 className="font-semibold text-white/90 text-[14.5px]">{s.title}</h3>
                  </div>
                  <p className="text-[13px] text-white/45 leading-relaxed">{s.body}</p>
                </div>
                <ChevronRight className={cn("flex-shrink-0 w-4 h-4 self-center opacity-0 group-hover:opacity-100 transition-opacity", s.col)} />
              </div>
              {i < STEPS.length - 1 && (
                <div className="absolute left-[1.65rem] -bottom-3 w-px h-3 bg-white/[0.06]" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Capabilities</p>
            <h2 className="text-[2rem] font-bold tracking-tight mb-4">Built different.</h2>
            <p className="text-white/45 max-w-lg mx-auto text-[14.5px] leading-relaxed">
              Every component was designed to make the system smarter over time —
              not just faster at doing the same dumb thing.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title}
                className={cn(
                  "group relative p-6 rounded-2xl border border-white/[0.07] bg-white/[0.025]",
                  "hover:bg-white/[0.04] hover:border-white/[0.12]",
                  "transition-all duration-200",
                  f.glow,
                )}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <f.icon className={cn("w-4.5 h-4.5", f.accent)} />
                  </div>
                  <h3 className="font-semibold text-[13.5px] text-white/85">{f.title}</h3>
                </div>
                <p className="text-[12.5px] text-white/40 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare ─────────────────────────────────────────────────── */}
      <section id="compare" className="border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Why REKALL</p>
            <h2 className="text-[2rem] font-bold tracking-tight mb-4">Not just another AI fix bot.</h2>
            <p className="text-white/45 max-w-lg mx-auto text-[14.5px] leading-relaxed">
              Most tools call the LLM and forget. REKALL remembers every fix,
              learns from every outcome, and compounds knowledge over time.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-3 bg-white/[0.03] border-b border-white/[0.07] px-6 py-3.5">
              <span className="text-[10.5px] font-bold text-white/30 uppercase tracking-[0.14em]">Feature</span>
              <span className="text-[10.5px] font-bold text-primary uppercase tracking-[0.14em] flex items-center gap-1.5">
                <Zap className="w-3 h-3" />REKALL
              </span>
              <span className="text-[10.5px] font-bold text-white/20 uppercase tracking-[0.14em]">Others</span>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.feature}
                className={cn(
                  "grid grid-cols-3 px-6 py-3.5 border-b border-white/[0.04] last:border-0",
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                )}>
                <span className="text-[12.5px] font-medium text-white/40">{row.feature}</span>
                <span className="text-[12.5px] text-white/75 flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  {row.rekall}
                </span>
                <span className="text-[12.5px] text-white/25">{row.bad}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Architecture</p>
              <h2 className="text-[1.8rem] font-bold tracking-tight mb-4 leading-tight">
                Go + Python + Next.js.<br />Each layer owns its job.
              </h2>
              <p className="text-[13.5px] text-white/45 leading-relaxed mb-8">
                The Go backend handles HTTP, SSE, and Postgres with zero latency. The Python
                engine runs LangGraph agents, ChromaDB vault, and Groq calls in complete isolation.
                The Next.js frontend streams every agent step live.
              </p>
              <div className="space-y-2">
                {STACK.map(({ tech, desc, dot }) => (
                  <div key={tech} className="flex items-center gap-3">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
                    <span className="text-[12px] font-semibold text-white/70 font-mono w-[130px] flex-shrink-0">{tech}</span>
                    <span className="text-[12px] text-white/30">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual pipeline */}
            <div className="relative space-y-2.5">
              {[
                { label: "GitHub Actions",     sub: "webhook source · real failures",      dot: "bg-yellow-400",  glow: "shadow-[0_0_16px_-4px_rgba(250,204,21,0.3)]"  },
                { label: "Go Backend",         sub: "incident router · SSE broker",        dot: "bg-sky-400",     glow: "shadow-[0_0_16px_-4px_rgba(56,189,248,0.3)]"  },
                { label: "Python Engine",      sub: "5-agent LangGraph pipeline",          dot: "bg-purple-400",  glow: "shadow-[0_0_16px_-4px_rgba(192,132,252,0.3)]" },
                { label: "ChromaDB Vault",     sub: "vector memory · ANN search",          dot: "bg-emerald-400", glow: "shadow-[0_0_16px_-4px_rgba(52,211,153,0.3)]"  },
                { label: "Next.js Dashboard",  sub: "live stream · approval panel",        dot: "bg-blue-400",    glow: "shadow-[0_0_16px_-4px_rgba(96,165,250,0.3)]"  },
              ].map((item, i, arr) => (
                <div key={item.label} className="relative">
                  <div className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/[0.07] bg-white/[0.025]",
                    item.glow,
                  )}>
                    <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", item.dot)} />
                    <div>
                      <p className="text-[13px] font-semibold text-white/85">{item.label}</p>
                      <p className="text-[11px] text-white/30">{item.sub}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="absolute left-[1.6rem] -bottom-2.5 w-px h-2.5 bg-white/[0.08]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.05] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/[0.07] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-7 mx-auto shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]">
            <Terminal className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-[2rem] font-bold tracking-tight mb-4">
            Ready to see it live?
          </h2>
          <p className="text-white/45 mb-9 text-[14.5px] leading-relaxed">
            Open the dashboard, fire a simulated failure, and watch five agents
            diagnose, retrieve, govern, and fix it — streaming in real time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[13.5px] hover:bg-primary-hover transition-all shadow-[0_0_28px_-4px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_36px_-4px_hsl(var(--primary)/0.7)]">
              Open dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/vault"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/[0.1] bg-white/[0.03] text-[13.5px] font-medium text-white/55 hover:text-white/80 hover:border-white/20 hover:bg-white/[0.06] transition-all">
              <Database className="w-4 h-4" />
              Explore memory vault
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 border border-primary/25">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[12px] font-bold tracking-tight text-white/30">REKALL</span>
          </div>
          <p className="text-[11px] text-white/20">Memory-driven agentic CI/CD repair · Go · Python · Next.js</p>
          <div className="flex items-center gap-5 text-[12px] text-white/25">
            {[["Dashboard", "/dashboard"], ["Vault", "/vault"], ["RL Metrics", "/rl-metrics"]].map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-white/50 transition-colors">{l}</Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
