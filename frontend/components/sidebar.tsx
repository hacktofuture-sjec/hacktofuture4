"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, Database, BarChart3,
  Radio, GitBranch, ChevronRight, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/vault",       label: "Memory Vault", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-100 bg-white"
      style={{ width: "var(--sidebar-width)" }}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-50 bg-white">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-600 shadow-lg shadow-orange-500/20">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black tracking-tight text-slate-900 leading-none">REKALL</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Enterprise CI/CD</p>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
        <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Navigation
        </p>
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all relative",
                active
                  ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0 transition-colors",
                active ? "text-orange-400" : "text-slate-400 group-hover:text-slate-900"
              )} />
              <span className="flex-1 truncate">{label}</span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </Link>
          );
        })}

        {/* ── Sources ─────────────────────────────────── */}
        <div className="pt-8">
          <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Live Sources
          </p>
          <div className="space-y-1">
            {[
              { label: "GitHub Actions", icon: GitBranch, color: "text-emerald-500" },
              { label: "GitLab CI",      icon: GitBranch, color: "text-orange-500"  },
              { label: "Simulator",      icon: Radio,     color: "text-indigo-500"  },
            ].map(({ label, icon: Icon, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50/50 transition-colors cursor-default group"
              >
                <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
                <span className="text-xs font-bold truncate">{label}</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-primary transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-4 py-6 space-y-5 bg-white">
        <div className="flex items-center gap-2.5 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_0_4px_rgba(16,185,129,0.1)]" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Engine: Live</span>
        </div>

        <div className="pt-2 border-t border-slate-50">
          <p className="text-[9px] font-black text-slate-300 text-center uppercase tracking-[0.2em]">REKALL · v1.0.0 ENTERPRISE</p>
        </div>
      </div>
    </aside>
  );
}
