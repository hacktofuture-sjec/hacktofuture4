import { cn } from "@/lib/utils";

const VARIANTS = {
  default:  "bg-slate-100 text-slate-600 border border-slate-200",
  primary:  "bg-orange-500/10 text-orange-600 border border-orange-500/20",
  success:  "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  warning:  "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  danger:   "bg-red-500/10 text-red-600 border border-red-500/20",
  info:     "bg-sky-500/10 text-sky-600 border border-sky-500/20",
  muted:    "bg-slate-50 text-slate-400 border border-slate-100",
  outline:  "bg-transparent text-slate-900 border border-slate-200",
  purple:   "bg-purple-500/10 text-purple-600 border border-purple-500/20",
  orange:   "bg-orange-500/10 text-orange-600 border border-orange-500/20",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ variant = "default", className, children, dot, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 flex-shrink-0" />}
      {children}
    </span>
  );
}
