import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  accent?:  string;   /* CSS color string, e.g. "hsl(217 91% 60%)" */
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
    <div
      className={cn(
        "relative rounded-xl p-5 overflow-hidden",
        "border bg-card transition-all duration-200",
        "hover:border-[var(--border-strong)]",
        className,
      )}
      style={{
        borderColor: accent ? `${accent}22` : undefined,
        boxShadow: accent
          ? `0 0 28px -8px ${accent}18, inset 0 1px 0 ${accent}0a`
          : "0 1px 3px hsl(0 0% 0% / 0.12)",
      }}
    >
      {/* Top accent bar */}
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl"
          style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)` }}
        />
      )}

      {/* Corner glow */}
      {accent && (
        <div
          className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-[0.06] pointer-events-none"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex-1 min-w-0 space-y-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.1em] truncate"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {label}
          </p>
          <p
            className="text-3xl font-bold tracking-tight leading-none"
            style={{ color: accent ?? "hsl(var(--foreground))" }}
          >
            {value}
          </p>
          {sub && (
            <div className="flex items-center gap-1">
              {trend && <TrendIcon className={cn("w-3 h-3", trendColor)} />}
              <p className={cn("text-[11px]", trendColor)}>{sub}</p>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
            style={accent ? {
              background: `${accent}14`,
              border: `1px solid ${accent}22`,
              color: accent,
            } : {
              background: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
