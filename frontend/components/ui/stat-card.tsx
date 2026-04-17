import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  accent?:  string;
  icon?:    React.ReactNode;
  trend?:   "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ label, value, sub, accent, icon, trend, className }: StatCardProps) {
  const TrendIcon =
    trend === "up"   ? TrendingUp   :
    trend === "down" ? TrendingDown :
    Minus;

  const trendColor =
    trend === "up"   ? "text-emerald-500" :
    trend === "down" ? "text-red-500"     :
    "text-muted-foreground";

  return (
    <div className={cn(
      "relative border border-border rounded-xl p-5 bg-card card-lift overflow-hidden",
      className,
    )}>
      {/* Subtle top accent line */}
      {accent && (
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl opacity-60" style={{ background: accent }} />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
            {value}
          </p>
          {sub && (
            <div className="flex items-center gap-1">
              {trend && <TrendIcon className={cn("w-3 h-3", trendColor)} />}
              <p className={cn("text-xs", trendColor)}>{sub}</p>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-2 rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
