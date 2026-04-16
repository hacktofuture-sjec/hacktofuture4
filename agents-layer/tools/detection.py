"""Detection scan combining Loki signals and cluster snapshot (aligned with backend `DetectionService`)."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List

from .kubernetes_snapshot import kubernetes_cluster_snapshot
from .observability import loki_query_range

ERROR_KEYWORDS = ("error", "exception", "fail", "failed", "panic", "fatal", "timeout")
WARN_KEYWORDS = ("warn", "warning", "degraded", "retry")


def _severity_from_text(text: str) -> str:
    raw = text.lower()
    if any(token in raw for token in ERROR_KEYWORDS):
        return "error"
    if any(token in raw for token in WARN_KEYWORDS):
        return "warning"
    return "info"


def _nanos_to_iso(raw: str) -> str | None:
    try:
        ts_seconds = int(raw) / 1_000_000_000
        return datetime.fromtimestamp(ts_seconds, tz=timezone.utc).isoformat()
    except Exception:  # pylint: disable=broad-except
        return None


def _normalize_signals(loki_raw: Dict[str, Any], cluster_snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    for stream in loki_raw.get("data", {}).get("result", []):
        service = (
            stream.get("stream", {}).get("lerna.source.service")
            or stream.get("stream", {}).get("service_name")
            or "unknown-service"
        )
        for ts, line in stream.get("values", []):
            output.append(
                {
                    "signal_type": "log",
                    "source": service,
                    "severity": _severity_from_text(line),
                    "message": line,
                    "timestamp": _nanos_to_iso(ts),
                }
            )

    for event in cluster_snapshot.get("recent_events", []):
        event_type = (event.get("type") or "").lower()
        severity = "warning" if event_type == "warning" else "info"
        output.append(
            {
                "signal_type": "event",
                "source": event.get("object") or event.get("namespace") or "k8s-event",
                "severity": severity,
                "message": event.get("message") or event.get("reason") or "Kubernetes event",
                "timestamp": event.get("last_timestamp"),
            }
        )
    return output


def _correlate(items: List[Dict[str, Any]]) -> Dict[str, int]:
    counter: Counter[str] = Counter()
    for item in items:
        bucket = f"{item['source']}:{item['severity']}"
        counter[bucket] += 1
    return dict(counter)


def run_detection_check(log_query: str = "{}", log_limit: int = 150) -> Dict[str, Any]:
    """
    Run the same style of detection as `GET /api/detection/check`: Loki scan + recent events from cluster snapshot.
    """
    snapshot = kubernetes_cluster_snapshot()
    if not snapshot.get("available"):
        return {
            "ok": False,
            "has_error": False,
            "message": f"Cluster snapshot unavailable: {snapshot.get('reason')}",
            "checked_at": datetime.now(tz=timezone.utc).isoformat(),
            "summary": {},
            "evidence": [],
        }

    try:
        loki_raw = loki_query_range(query=log_query, limit=log_limit)
    except Exception as exc:  # pylint: disable=broad-except
        return {
            "ok": False,
            "has_error": False,
            "message": f"Loki query failed: {exc}",
            "checked_at": datetime.now(tz=timezone.utc).isoformat(),
            "summary": {},
            "evidence": [],
        }

    normalized = _normalize_signals(loki_raw, snapshot)
    correlated = _correlate(normalized)
    error_count = sum(1 for item in normalized if item["severity"] in {"error", "critical"})
    warning_count = sum(1 for item in normalized if item["severity"] == "warning")
    has_error = error_count > 0
    message = (
        f"Errors detected in observation signals ({error_count} high-severity matches)."
        if has_error
        else "No errors detected in the latest observation signals."
    )
    return {
        "ok": True,
        "has_error": has_error,
        "message": message,
        "checked_at": datetime.now(tz=timezone.utc).isoformat(),
        "summary": {
            "signals_scanned": len(normalized),
            "error_count": error_count,
            "warning_count": warning_count,
            "correlated_groups": len(correlated),
        },
        "evidence": normalized[:20],
    }
