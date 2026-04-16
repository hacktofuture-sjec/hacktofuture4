/* eslint-disable react-refresh/only-export-components */
/**
 * Small, unstyled-first UI primitives. Tailwind-based so they stay in sync
 * with the existing VoxBridge dark theme. Intentionally tiny — we don't pull
 * a component library here.
 *
 * Helpers (statusTone, formatDate) live in this file for convenience; the
 * react-refresh rule is relaxed above because HMR correctness isn't a concern
 * for these leaf primitives.
 */
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode, HTMLAttributes, ButtonHTMLAttributes } from 'react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 text-gray-500">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3 text-gray-600">
        {icon ?? <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      {hint && <p className="text-xs mt-1 text-gray-500 max-w-sm">{hint}</p>}
    </div>
  );
}

export function Card({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-[#0f1318] border border-white/[0.06] rounded-xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: BtnProps) {
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:bg-indigo-600/40',
    ghost:
      'bg-transparent hover:bg-white/[0.05] text-gray-300 border border-white/10',
    subtle:
      'bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 border border-white/[0.06]',
    danger:
      'bg-red-600/90 hover:bg-red-500 text-white',
  };
  return (
    <button
      className={`px-3.5 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-gray-400 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    danger: 'bg-red-500/10 text-red-300 border-red-500/25',
    info: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(
  status: string | undefined | null
): 'neutral' | 'success' | 'warn' | 'danger' | 'info' {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (['succeeded', 'success', 'resolved', 'connected', 'processed', 'accepted'].includes(s))
    return 'success';
  if (['failed', 'error', 'blocked', 'revoked', 'expired'].includes(s)) return 'danger';
  if (['pending', 'retry', 'running', 'in_progress'].includes(s)) return 'warn';
  if (['open', 'active'].includes(s)) return 'info';
  return 'neutral';
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-600 mt-1">{hint}</span>}
    </label>
  );
}

export function Input({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] ${className}`}
      {...rest}
    />
  );
}

export function TextArea({
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] ${className}`}
      {...rest}
    />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.12em] text-gray-500">
      {children}
    </thead>
  );
}

export function TR({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-t border-white/[0.05] hover:bg-white/[0.02] ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ children }: { children?: ReactNode }) {
  return <th className="text-left font-medium px-4 py-2.5">{children}</th>;
}

export function TD({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 text-gray-300 ${className}`}>{children}</td>;
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="bg-[#0a0d12] border border-white/[0.05] rounded-lg p-3 text-[11px] text-gray-400 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}
