/* eslint-disable react-refresh/only-export-components */
/**
 * UI primitives — the design system's leaf components.
 *
 * Everything here is Tailwind-first and takes a `className` prop so consumers
 * can override. Helpers (`statusTone`, `formatDate`, `formatRelative`) live in
 * this file too; the react-refresh rule is relaxed because HMR correctness
 * isn't a concern for these pure leaves.
 */
import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// ── Motion ──────────────────────────────────────────────────────────────────

export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Loading ─────────────────────────────────────────────────────────────────

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[color:var(--text-lo)]">
      <Loader2 className="w-4 h-4 animate-spin text-[color:var(--brand-400)]" />
      <span>{label ?? 'Loading…'}</span>
    </div>
  );
}

/** Multi-bar shimmer placeholder. Matches the vertical rhythm of a row list. */
export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer rounded-lg h-12 w-full"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`shimmer rounded-xl h-28 w-full ${className}`} />
  );
}

// ── Errors / Empty ──────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/[0.08] text-sm text-[color:var(--danger)]">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="leading-relaxed text-rose-200/90">{message}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="relative mb-4">
        <div className="absolute -inset-4 rounded-full bg-indigo-500/10 blur-xl" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center text-[color:var(--text-lo)] shadow-[var(--shadow-md)]">
          {icon ?? <Inbox className="w-6 h-6" />}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-[color:var(--text-hi)] tracking-tight">{title}</h3>
      {hint && <p className="text-xs mt-1.5 text-[color:var(--text-lo)] max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Applies a subtle gradient hairline border. */
  variant?: 'default' | 'glass' | 'outline';
  /** Elevation — affects shadow. */
  elevated?: boolean;
};

export function Card({
  className = '',
  variant = 'default',
  elevated = false,
  children,
  ...rest
}: CardProps) {
  const base = 'relative rounded-2xl';
  const variants: Record<string, string> = {
    default: 'bg-[color:var(--surface-2)] border border-[color:var(--border-soft)]',
    glass: 'glass border border-[color:var(--border-soft)]',
    outline: 'bg-transparent border border-[color:var(--border-soft)]',
  };
  const shadow = elevated ? 'shadow-[var(--shadow-md)]' : '';
  return (
    <div className={`${base} ${variants[variant]} ${shadow} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)] font-semibold mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] leading-none font-semibold text-[color:var(--text-hi)] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[color:var(--text-lo)] mt-1.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle' | 'outline';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: BtnProps) {
  const sizes: Record<BtnSize, string> = {
    sm: 'h-8 px-3 text-[12px]',
    md: 'h-9 px-3.5 text-[13px]',
    lg: 'h-11 px-5 text-[14px]',
  };
  const variants: Record<BtnVariant, string> = {
    primary: [
      'text-white',
      'bg-[image:linear-gradient(135deg,var(--brand-500),var(--brand-700))]',
      'hover:brightness-110',
      'shadow-[var(--shadow-brand)]',
      'border border-white/10',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-90',
    ].join(' '),
    ghost:
      'bg-transparent hover:bg-white/[0.04] text-[color:var(--text-md)] border border-transparent',
    subtle:
      'bg-white/[0.04] hover:bg-white/[0.07] text-[color:var(--text-hi)] border border-[color:var(--border-soft)]',
    outline:
      'bg-transparent hover:bg-white/[0.03] text-[color:var(--text-hi)] border border-[color:var(--border-soft)]',
    danger:
      'bg-rose-600/90 hover:bg-rose-500 text-white border border-white/10 shadow-sm',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'brand';

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  const tones: Record<Tone, { bg: string; text: string; border: string; dot: string }> = {
    neutral: { bg: 'bg-white/5', text: 'text-[color:var(--text-md)]', border: 'border-white/10', dot: 'bg-slate-400' },
    success: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
    warn:    { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25',   dot: 'bg-amber-400' },
    danger:  { bg: 'bg-rose-500/10',    text: 'text-rose-300',    border: 'border-rose-500/25',    dot: 'bg-rose-400' },
    info:    { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/25',     dot: 'bg-sky-400' },
    brand:   { bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  border: 'border-indigo-500/25',  dot: 'bg-indigo-400' },
  };
  const t = tones[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${t.bg} ${t.text} ${t.border}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
      {children}
    </span>
  );
}

export function statusTone(status: string | undefined | null): Tone {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (['succeeded', 'success', 'resolved', 'connected', 'processed', 'accepted', 'active', 'healthy'].includes(s)) return 'success';
  if (['failed', 'error', 'blocked', 'revoked', 'expired', 'unhealthy'].includes(s)) return 'danger';
  if (['pending', 'retry', 'running', 'in_progress', 'processing', 'syncing'].includes(s)) return 'warn';
  if (['open', 'new'].includes(s)) return 'info';
  return 'neutral';
}

// ── Forms ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && (
        <span className="flex items-center gap-1 text-xs font-medium text-[color:var(--text-md)] mb-1.5">
          {label}
          {required && <span className="text-rose-400">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="block text-[11px] text-rose-300 mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-[color:var(--text-dim)] mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

const fieldBase =
  'w-full bg-[color:var(--surface-2)]/60 border border-[color:var(--border-soft)] rounded-xl px-3.5 py-2.5 text-[13px] text-[color:var(--text-hi)] placeholder:text-[color:var(--text-dim)] transition-all focus:outline-none focus:border-[color:var(--brand-500)]/60 focus:bg-[color:var(--surface-2)] focus:ring-2 focus:ring-[color:var(--brand-500)]/20';

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}

export function TextArea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} ${className}`} {...rest} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} pr-9 cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-dim)] border-b border-[color:var(--border-soft)]">
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
      className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ children }: { children?: ReactNode }) {
  return <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">{children}</th>;
}

export function TD({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-[color:var(--text-md)] align-middle ${className}`}>{children}</td>;
}

// ── JSON preview ────────────────────────────────────────────────────────────

export function JsonBlock({ value, maxH = 320 }: { value: unknown; maxH?: number }) {
  return (
    <pre
      className="bg-[color:var(--surface-0)] border border-[color:var(--border-soft)] rounded-xl p-3.5 text-[11px] leading-relaxed text-[color:var(--text-md)] overflow-auto font-mono"
      style={{ maxHeight: maxH }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────────────
// Tiny inline line chart, no chart-library dependency. Values are normalized
// to [0, 1] over the series and drawn as an SVG polyline with a soft fill.

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = 'url(#spark-grad)',
  fill = 'url(#spark-fill)',
  className = '',
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  const pts = data.length ? data : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = pts.length > 1 ? width / (pts.length - 1) : 0;
  const path = pts
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={fill} />
      <path d={path} stroke={stroke} strokeWidth={1.75} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  delta,
  icon,
  trend,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  /** e.g. "+12.4%" */
  delta?: string;
  icon?: ReactNode;
  /** Small sparkline data series */
  trend?: number[];
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    neutral: 'from-slate-500/20 to-slate-500/5 text-slate-300',
    brand:   'from-indigo-500/25 to-violet-500/5 text-indigo-200',
    info:    'from-sky-500/25 to-sky-500/5 text-sky-200',
    success: 'from-emerald-500/25 to-emerald-500/5 text-emerald-200',
    warn:    'from-amber-500/25 to-amber-500/5 text-amber-200',
    danger:  'from-rose-500/25 to-rose-500/5 text-rose-200',
  };
  return (
    <Card className="p-4 transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-dim)] font-semibold">
          {label}
        </span>
        {icon && (
          <span
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tones[tone]} border border-white/10 flex items-center justify-center`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-[color:var(--text-hi)] tracking-tight">
            {value}
          </div>
          {delta && (
            <div className="text-[11px] text-[color:var(--text-lo)] mt-0.5">{delta}</div>
          )}
        </div>
        {trend && trend.length > 0 && (
          <Sparkline data={trend} width={96} height={32} />
        )}
      </div>
    </Card>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────

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

/** Short relative time, e.g. "2m", "3h", "4d". Falls back to formatDate. */
export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(value);
}

// ── Divider / Kbd ───────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="h-px w-full bg-[color:var(--border-soft)]" />;
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-[color:var(--border-soft)]" />
      <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)] font-semibold">
        {label}
      </span>
      <div className="flex-1 h-px bg-[color:var(--border-soft)]" />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 min-w-[1.4rem] h-5 px-1.5 rounded-md border border-[color:var(--border-soft)] bg-white/[0.04] text-[10px] text-[color:var(--text-md)] font-mono">
      {children}
    </kbd>
  );
}

// ── Simple tab control ──────────────────────────────────────────────────────

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-[color:var(--surface-2)] border border-[color:var(--border-soft)] rounded-xl">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 h-8 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 transition-all ${
              active
                ? 'bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-white border border-indigo-500/30 shadow-inner'
                : 'text-[color:var(--text-lo)] hover:text-[color:var(--text-hi)]'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className={`text-[10px] px-1.5 rounded-md ${active ? 'bg-white/10' : 'bg-white/[0.04]'} text-[color:var(--text-lo)]`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
