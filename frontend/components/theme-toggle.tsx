"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (compact) {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark"
          ? <Sun className="w-4 h-4" />
          : <Moon className="w-4 h-4" />
        }
      </button>
    );
  }

  const options = [
    { value: "light" as const,  icon: Sun,     label: "Light" },
    { value: "dark"  as const,  icon: Moon,    label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-muted">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
            theme === value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={label}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
