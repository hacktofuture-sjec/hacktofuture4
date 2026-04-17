import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(ts: string): string {
  const delta = (Date.now() - new Date(ts).getTime()) / 1000;
  if (delta < 60)   return `${Math.round(delta)}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmtScore(n: number): string {
  return n.toFixed(3);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
