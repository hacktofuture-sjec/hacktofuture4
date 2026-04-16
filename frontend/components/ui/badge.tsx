import { cn } from "@/lib/utils";

const VARIANTS = {
  default:  "bg-secondary text-secondary-foreground border border-border/60",
  primary:  "bg-primary/10 text-primary border border-primary/20",
  success:  "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 dark:text-emerald-400",
  warning:  "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400",
  danger:   "bg-red-500/10 text-red-600 border border-red-500/20 dark:text-red-400",
  info:     "bg-sky-500/10 text-sky-600 border border-sky-500/20 dark:text-sky-400",
  muted:    "bg-muted text-muted-foreground border border-transparent",
  outline:  "bg-transparent text-foreground border border-border",
  purple:   "bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400",
  orange:   "bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:text-orange-400",
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
