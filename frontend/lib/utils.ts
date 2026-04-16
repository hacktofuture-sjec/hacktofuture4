/**
 * Format an ISO8601 timestamp as "X minutes ago" / "X seconds ago"
 */
export function formatDistanceToNow(isoString: string): string {
  const timestampMs = new Date(isoString).getTime();
  if (!Number.isFinite(timestampMs)) return "0s ago";

  const diffMs = Date.now() - timestampMs;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
