"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, Database, BarChart3,
  Radio, GitBranch, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  badge?: string;
  accent?: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",    icon: LayoutDashboard, accent: "hsl(217 91% 60%)" },
  { href: "/vault",       label: "Memory Vault", icon: Database,        accent: "hsl(142 69% 42%)" },
  { href: "/rl-metrics",  label: "RL Metrics",   icon: BarChart3,       accent: "hsl(262 83% 65%)" },
];

const SOURCES = [
  { label: "GitHub Actions", icon: GitBranch, color: "text-emerald-500", dot: "bg-emerald-500" },
  { label: "GitLab CI",      icon: GitBranch, color: "text-orange-500",  dot: "bg-orange-400"  },
  { label: "Simulator",      icon: Radio,     color: "text-purple-500",  dot: "bg-purple-500"  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col"
      style={{
        width: "var(--sidebar-width)",
        background: "hsl(var(--sidebar-bg))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-[18px]"
        style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}
      >
        <div
          className="relative flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden"
          style={{
            background: "hsl(217 91% 60% / 0.12)",
            border: "1px solid hsl(217 91% 60% / 0.25)",
            boxShadow: "0 0 12px -2px hsl(217 91% 60% / 0.25)",
          }}
        >
          <Zap className="w-4 h-4 text-primary relative z-10" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-tight text-foreground leading-none">REKALL</p>
          <p
            className="text-[10px] mt-0.5 font-mono uppercase tracking-widest"
            style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}
          >
            CI/CD Repair
          </p>
        </div>
        {/* Live pulse dot */}
        <div className="relative flex-shrink-0">
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span
            className="absolute inset-0 rounded-full bg-emerald-500 animate-ping"
            style={{ animationDuration: "2.5s", opacity: 0.4 }}
          />
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p
          className="px-2 mb-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
        >
          Navigation
        </p>
        {NAV.map(({ href, label, icon: Icon, accent }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={active ? {
                background: `${accent}14`,
                border: `1px solid ${accent}22`,
                boxShadow: `0 0 16px -4px ${accent}28`,
              } : {
                border: "1px solid transparent",
              }}
            >
              {/* Active left bar */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                  style={{ height: "55%", background: accent }}
                />
              )}

              <span style={active ? { color: accent } : {}}>
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    active ? "" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
              </span>
              <span className="flex-1 truncate">{label}</span>
              {active && (
                <span style={{ color: accent }}>
                  <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                </span>
              )}
            </Link>
          );
        })}

        {/* ── Sources section ───────────────────────────────── */}
        <div className="pt-5">
          <p
            className="px-2 mb-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
          >
            Sources
          </p>
          <div className="space-y-0.5">
            {SOURCES.map(({ label, icon: Icon, color, dot }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-default"
                style={{ color: "hsl(var(--muted-foreground))", opacity: 0.65 }}
              >
                <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
                <span className="text-xs truncate">{label}</span>
                <span className={cn("ml-auto w-1.5 h-1.5 rounded-full opacity-40", dot)} />
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className="px-4 py-3.5 space-y-3"
        style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}
      >
        {/* Live indicator */}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{
            background: "hsl(142 69% 42% / 0.06)",
            border: "1px solid hsl(142 69% 42% / 0.14)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
            style={{ boxShadow: "0 0 0 2px hsl(142 69% 42% / 0.25)" }}
          />
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Stream active
          </span>
          <span
            className="ml-auto text-[10px] font-mono uppercase tracking-wide"
            style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
          >
            SSE
          </span>
        </div>

        {/* Theme toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Theme
          </span>
          <ThemeToggle compact />
        </div>

        <p
          className="text-[10px] font-mono text-center"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }}
        >
          v1.0.0 · REKALL
        </p>
      </div>
    </aside>
  );
}
