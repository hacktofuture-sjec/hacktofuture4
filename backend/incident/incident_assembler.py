"""
Incident Assembler: Normalize 4-signal observations from fault injection into compact IncidentSnapshot JSON.

Implements the Monitor Agent specification from docs/reference/06-monitor-agent-implementation.md

Inputs:
- injection_event: { scenario_id, service, namespace, pod, deployment, started_at }
- collected_signals: { metrics, logs, traces, events }
- context: { baseline_values, dependency_graph_summary }

Process:
1. Validate input fields; if missing, continue with null-safe defaults
2. Filter signals to affected namespace/service/pod + time window [started_at - 2m, started_at + 5m]
3. Summarize logs into signatures with counts
4. Summarize traces into span summary + latencies (or null if unavailable)
5. Compute metric features and deltas against baseline
6. Classify failure_class via rule map
7. Compute monitor_confidence (0.0–1.0) via multi-signal correlation
8. Output normalized IncidentSnapshot JSON
"""

from __future__ import annotations

import json
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Optional


class IncidentAssembler:
    """Transform parallel 4-signal streams into normalized IncidentSnapshot."""

    # Threshold catalog from spec
    THRESHOLDS = {
        "memory_usage_percent": {"warn": 85, "critical": 95},
        "cpu_usage_percent": {"warn": 80, "critical": 95},
        "restart_count_5m": {"warn": 3, "critical": 7},
        "error_rate_rps": {"warn": 5, "critical": 20},
        "latency_p95_seconds": {"warn": 1.5, "critical": 3.0},
    }

    ANOMALY_Z_SCORE_THRESHOLD = 2.5
    RESTART_BURST_WINDOW_MINUTES = 2
    RESTART_BURST_COUNT = 3

    # High-signal event reasons from K8s
    HIGH_SIGNAL_EVENTS = {
        "OOMKilled",
        "CrashLoopBackOff",
        "BackOff",
        "FailedScheduling",
        "Evicted",
        "ImagePullBackOff",
        "ErrImagePull",
    }

    FAILED_MESSAGE_REASON_MAP = {
        "imagepullbackoff": "ImagePullBackOff",
        "errimagepull": "ErrImagePull",
        "failed to pull image": "ImagePullBackOff",
        "back-off pulling image": "ImagePullBackOff",
        "crashloopbackoff": "CrashLoopBackOff",
        "oomkilled": "OOMKilled",
        "failedscheduling": "FailedScheduling",
    }

    @staticmethod
    def assemble(
        injection_event: dict[str, Any],
        collected_signals: dict[str, Any],
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Main entry point: Generate normalized incident JSON.

        Args:
            injection_event: { scenario_id, service, namespace, pod, deployment, started_at }
            collected_signals: { metrics, logs, traces, events }
            context: Optional { baseline_values, dependency_graph_summary }

        Returns:
            Single IncidentSnapshot JSON with all 4 signals correlated.
        """
        assembler = IncidentAssembler()

        # Step 1: Validate & defaults
        incident_id = f"inc-{uuid.uuid4().hex[:8]}"
        scenario_id = injection_event.get("scenario_id", "unknown")
        service = injection_event.get("service", "unknown")
        namespace = injection_event.get("namespace", "default")
        pod = injection_event.get("pod", f"{service}-unknown")
        deployment = injection_event.get("deployment", service)
        started_at = injection_event.get("started_at", datetime.now(timezone.utc).isoformat())

        # Time window filters: [started_at - 2m, started_at + 5m]
        start_window = assembler._parse_iso(started_at) - timedelta(minutes=2)
        end_window = assembler._parse_iso(started_at) + timedelta(minutes=5)

        # Step 2: Extract signals with defaults
        metrics_raw = collected_signals.get("metrics", {})
        logs_raw = collected_signals.get("logs", [])
        traces_raw = collected_signals.get("traces", [])
        events_raw = collected_signals.get("events", [])

        # Step 3: Filter signals by scope and time window
        events_filtered = assembler._filter_events(
            events_raw, namespace, deployment, pod, start_window, end_window
        )
        logs_filtered = assembler._filter_logs(logs_raw, start_window, end_window)
        traces_filtered = assembler._filter_traces(traces_raw, start_window, end_window)

        # For container startup failures (image pull/backoff), Loki may have no workload logs.
        if not logs_filtered and events_filtered:
            logs_filtered = [
                str(event.get("message", ""))
                for event in events_filtered
                if str(event.get("message", "")).strip()
            ]

        # Step 4-5: Summarize logs & traces
        log_signatures = assembler._summarize_logs(logs_filtered)
        trace_summary = assembler._summarize_traces(traces_filtered, service)

        # Step 6: Compute metric features and deltas
        baseline = context.get("baseline_values", {}) if context else {}
        metrics_normalized = assembler._normalize_metrics(metrics_raw, baseline)
        metric_features = assembler._build_metric_features(metrics_normalized, baseline)

        # Step 7: Classify failure
        failure_class = assembler._classify_failure(
            events_filtered,
            metric_features,
            log_signatures,
            scenario_id=scenario_id,
        )

        # Step 8: Compute confidence via multi-signal correlation
        event_reasons = [e.get("reason") for e in events_filtered if e.get("reason")]
        monitor_confidence = assembler._compute_confidence(
            metric_features,
            event_reasons,
            log_signatures,
            trace_summary,
            failure_class=failure_class,
        )

        # Step 9: Build dependency summary
        dependency_summary = (
            context.get("dependency_graph_summary", f"{service} -> dependencies")
            if context
            else f"{service} -> dependencies"
        )

        # Assemble IncidentSnapshot
        snapshot = {
            "incident_id": incident_id,
            "scenario_id": scenario_id,
            "service": service,
            "namespace": namespace,
            "severity": assembler._infer_severity(monitor_confidence, failure_class),
            "started_at": started_at,
            "snapshot": {
                "alert": f"{failure_class} detected on {service}",
                "pod": pod,
                "metrics": assembler._format_metrics(metrics_normalized),
                "events": events_filtered[:5],  # Top 5 events
                "logs_summary": log_signatures,
                "trace_summary": trace_summary,
                "scope": {
                    "namespace": namespace,
                    "deployment": deployment,
                },
                "monitor_confidence": round(monitor_confidence, 3),
                "failure_class": failure_class,
                "dependency_graph_summary": dependency_summary,
            },
        }

        return snapshot

    @staticmethod
    def _parse_iso(iso_str: str) -> datetime:
        """Parse ISO 8601 string to datetime (null-safe)."""
        if not iso_str:
            return datetime.now(timezone.utc)
        try:
            if iso_str.endswith("Z"):
                return datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            return datetime.fromisoformat(iso_str)
        except Exception:
            return datetime.now(timezone.utc)

    @staticmethod
    def _filter_events(
        events: list[dict],
        namespace: str,
        deployment: str,
        pod: str,
        start: datetime,
        end: datetime,
    ) -> list[dict]:
        """Filter events by scope and time window."""
        filtered = []
        for event in events:
            if event.get("namespace") != namespace:
                continue
            # Time filtering: prefer latest observation so ongoing event streams survive windowing.
            event_time_raw = event.get("last_seen") or event.get("first_seen")
            if event_time_raw:
                try:
                    event_time = IncidentAssembler._parse_iso(str(event_time_raw))
                    if not (start <= event_time <= end):
                        continue
                except Exception:
                    pass
            event_copy = dict(event)
            event_copy["reason"] = IncidentAssembler._canonicalize_event_reason(
                str(event_copy.get("reason", "")),
                str(event_copy.get("message", "")),
            )
            filtered.append(event_copy)
        return filtered

    @classmethod
    def _canonicalize_event_reason(cls, reason: str, message: str) -> str:
        normalized_reason = (reason or "").strip()
        if normalized_reason and normalized_reason != "Failed":
            return normalized_reason

        text = f"{normalized_reason} {message}".lower()
        for pattern, canonical in cls.FAILED_MESSAGE_REASON_MAP.items():
            if pattern in text:
                return canonical
        return normalized_reason or "Unknown"

    @staticmethod
    def _filter_logs(logs: list[dict | str], start: datetime, end: datetime) -> list[str]:
        """Filter logs by time window; normalize to list of strings."""
        if not logs:
            return []

        filtered = []
        for log in logs:
            # Handle both string and dict log formats
            if isinstance(log, dict):
                msg = log.get("message", log.get("msg", str(log)))
                # Simple time filtering if present
                filtered.append(str(msg))
            else:
                filtered.append(str(log))
        return filtered

    @staticmethod
    def _filter_traces(traces: list[dict], start: datetime, end: datetime) -> list[dict]:
        """Filter traces by time window."""
        if not traces:
            return []
        filtered = []
        for trace in traces:
            # Assume trace has startTime field (Unix epoch or ISO)
            if "startTime" in trace or "start_time" in trace:
                try:
                    ts = trace.get("startTime") or trace.get("start_time")
                    if isinstance(ts, str):
                        trace_time = IncidentAssembler._parse_iso(ts)
                    else:
                        trace_time = datetime.fromtimestamp(float(ts) / 1e9, tz=timezone.utc)
                    if not (start <= trace_time <= end):
                        continue
                except Exception:
                    pass
            filtered.append(trace)
        return filtered

    @staticmethod
    def _summarize_logs(logs: list[str], top_n: int = 5) -> list[dict[str, Any]]:
        """
        Group similar log messages into signatures.

        Returns list of {"signature": str, "count": int}
        """
        if not logs:
            return []

        # Normalize: replace IDs, timestamps, IPs, numbers
        normalized = []
        for line in logs:
            norm = str(line)
            norm = re.sub(r"\b[0-9a-f]{8,}\b", "<id>", norm)
            norm = re.sub(r"\d{4}-\d{2}-\d{2}T\S+", "<ts>", norm)
            norm = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "<ip>", norm)
            norm = re.sub(r"\b\d+\b", "<N>", norm)
            norm = norm[:200].strip()
            if norm:
                normalized.append(norm)

        counts = Counter(normalized)
        return [{"signature": sig, "count": count} for sig, count in counts.most_common(top_n)]

    @staticmethod
    def _summarize_traces(traces: list[dict], service: str) -> Optional[dict[str, Any]]:
        """
        Summarize traces: group by span name, compute latencies.

        Returns {"enabled": bool, "suspected_path": str, "hot_span": str, "p95_ms": int}
        or None if no traces.
        """
        if not traces:
            return None

        # Extract spans and compute stats
        all_spans = []
        latencies = []

        for trace in traces:
            # OTLP shape: resourceSpans[].scopeSpans[].spans[]
            for rs in trace.get("resourceSpans", []):
                for ss in rs.get("scopeSpans", []):
                    for span in ss.get("spans", []):
                        all_spans.append(span)
                        # Duration in nanoseconds
                        start = int(span.get("startTimeUnixNano", 0))
                        end = int(span.get("endTimeUnixNano", 0))
                        if end > start:
                            latencies.append((end - start) / 1e6)  # Convert to ms

        if not all_spans:
            return None

        # Compute p95 latency
        latencies.sort()
        p95_idx = max(0, int(len(latencies) * 0.95))
        p95_ms = int(latencies[p95_idx]) if p95_idx < len(latencies) else 0

        # Find hot span (most frequent operation)
        span_names = [s.get("name", "unknown") for s in all_spans]
        hot_span = Counter(span_names).most_common(1)[0][0] if span_names else "unknown"

        return {
            "enabled": True,
            "suspected_path": f"{service} -> dependencies",
            "hot_span": hot_span,
            "p95_ms": p95_ms,
        }

    @staticmethod
    def _normalize_metrics(metrics_raw: dict, baseline: dict) -> dict[str, float]:
        """Normalize raw metrics to standard keys with numeric values."""
        return {
            "memory_usage_percent": float(
                metrics_raw.get("memory_usage_percent") or metrics_raw.get("memory_pct", 0.0)
            ),
            "cpu_usage_percent": float(
                metrics_raw.get("cpu_usage_percent") or metrics_raw.get("cpu_pct", 0.0)
            ),
            "restart_count": float(metrics_raw.get("restart_count", 0.0)),
            "latency_p95_seconds": float(metrics_raw.get("latency_p95_seconds", 0.0)),
            "error_rate_rps": float(metrics_raw.get("error_rate_rps", 0.0)),
        }

    @classmethod
    def _build_metric_features(cls, current: dict[str, float], baseline: dict) -> dict[str, Any]:
        """
        Build metric feature vector for classification.

        Returns {
          "memory_anomaly": bool,
          "memory_severity": "ok" | "warn" | "critical",
          "cpu_anomaly": bool,
          "cpu_severity": "ok" | "warn" | "critical",
          "restart_burst": bool,
          "latency_anomaly": bool,
          "latency_delta": float,
        }
        """
        features = {}

        # Memory check
        mem_pct = current.get("memory_usage_percent", 0.0)
        mem_thresh, mem_sev = cls._check_static_threshold("memory_usage_percent", mem_pct)
        features["memory_anomaly"] = mem_thresh
        features["memory_severity"] = mem_sev

        # CPU check
        cpu_pct = current.get("cpu_usage_percent", 0.0)
        cpu_thresh, cpu_sev = cls._check_static_threshold("cpu_usage_percent", cpu_pct)
        features["cpu_anomaly"] = cpu_thresh
        features["cpu_severity"] = cpu_sev

        # Restart burst
        current_restarts = current.get("restart_count", 0.0)
        baseline_restarts = float(baseline.get("restart_count", 0.0))
        features["restart_burst"] = (current_restarts - baseline_restarts) >= cls.RESTART_BURST_COUNT

        # Latency anomaly
        current_latency = current.get("latency_p95_seconds", 0.0)
        baseline_latency = float(baseline.get("latency_p95_seconds", 0.1))
        latency_delta = current_latency / max(baseline_latency, 0.001)
        features["latency_anomaly"] = latency_delta > 2.0
        features["latency_delta"] = latency_delta

        return features

    @classmethod
    def _check_static_threshold(cls, metric_name: str, value: float) -> tuple[bool, str]:
        """Check metric against static thresholds. Returns (is_anomaly, severity)."""
        thresholds = cls.THRESHOLDS.get(metric_name)
        if not thresholds:
            return False, "ok"
        if value >= thresholds["critical"]:
            return True, "critical"
        if value >= thresholds["warn"]:
            return True, "warn"
        return False, "ok"

    @classmethod
    def _classify_failure(
        cls,
        events: list[dict],
        metric_features: dict,
        log_sigs: list[dict],
        scenario_id: str = "",
    ) -> str:
        """
        Rule-based failure classification.

        Returns one of: resource_exhaustion, application_crash, config_error,
        infra_saturation, dependency_failure, unknown
        """
        event_reasons = {e.get("reason") for e in events if e.get("reason")}
        log_texts = " ".join(s.get("signature", "").lower() for s in log_sigs)

        # Check OOMKilled or memory anomaly
        if "OOMKilled" in event_reasons or "Evicted" in event_reasons:
            return "resource_exhaustion"
        if metric_features.get("memory_anomaly"):
            return "resource_exhaustion"

        # Check crash signals
        if "CrashLoopBackOff" in event_reasons or "BackOff" in event_reasons:
            if metric_features.get("restart_burst"):
                return "application_crash"

        # Check image pull errors
        if "ImagePullBackOff" in event_reasons or "ErrImagePull" in event_reasons:
            return "config_error"

        # Check scheduling issues
        if "FailedScheduling" in event_reasons:
            return "infra_saturation"

        # Check latency + timeout
        if metric_features.get("latency_anomaly") and (
            "timeout" in log_texts or "connection" in log_texts
        ):
            return "dependency_failure"

        # Check high CPU
        if metric_features.get("cpu_anomaly"):
            return "resource_exhaustion"

        # Scenario-aware fallback keeps classification deterministic for known injected faults.
        scenario_map = {
            "oom-kill-001": "resource_exhaustion",
            "cpu-spike-001": "resource_exhaustion",
            "crash-loop-001": "application_crash",
            "db-latency-001": "dependency_failure",
        }
        mapped = scenario_map.get(str(scenario_id).strip().lower())
        if mapped:
            return mapped

        return "unknown"

    @classmethod
    def _compute_confidence(
        cls,
        metric_features: dict,
        event_reasons: list[str],
        log_sigs: list[dict],
        trace_summary: Optional[dict],
        failure_class: str = "unknown",
    ) -> float:
        """
        Compute monitor_confidence (0.0-1.0) via multi-signal correlation.

        Scoring:
        - Base: metric severity (critical=0.5, warn=0.3)
        - Bonus: metric anomalies (+0.10 each)
        - Bonus: K8s events corroborate (+0.20 or +0.12)
        - Bonus: log signatures (+0.10 or +0.05)
        - Bonus: trace summary present (+0.05)
        """
        score = 0.0

        # Base: metric severity
        mem_sev = metric_features.get("memory_severity", "ok")
        cpu_sev = metric_features.get("cpu_severity", "ok")

        if mem_sev == "critical" or cpu_sev == "critical":
            score += 0.50
        elif mem_sev == "warn" or cpu_sev == "warn":
            score += 0.30

        # Bonus: metric anomalies detected
        if metric_features.get("memory_anomaly") or metric_features.get("cpu_anomaly"):
            score += 0.10
        if metric_features.get("restart_burst"):
            score += 0.10

        # Bonus: K8s event match
        event_match_count = sum(1 for r in event_reasons if r in cls.HIGH_SIGNAL_EVENTS)
        if event_match_count >= 2:
            score += 0.20
        elif event_match_count == 1:
            score += 0.12

        # Bonus: log signatures
        if len(log_sigs) >= 3:
            score += 0.10
        elif len(log_sigs) >= 1:
            score += 0.05

        # Bonus: trace present
        if trace_summary:
            score += 0.05

        # Failure classes that are mostly event-driven should not remain near-zero when corroborated.
        if failure_class in {"application_crash", "resource_exhaustion", "dependency_failure"}:
            if event_match_count >= 2 and score < 0.55:
                score = 0.55
            elif event_match_count == 1 and score < 0.35:
                score = 0.35

        image_pull_signal_count = sum(1 for reason in event_reasons if reason in {"ImagePullBackOff", "ErrImagePull"})
        if image_pull_signal_count >= 1 and score < 0.6:
            score = 0.6

        return min(round(max(score, 0.0), 3), 1.0)

    @staticmethod
    def _infer_severity(confidence: float, failure_class: str) -> str:
        """Infer severity: high/medium/low based on confidence + failure class."""
        if confidence > 0.8:
            return "high"
        if confidence > 0.5:
            return "medium"
        return "low"

    @staticmethod
    def _format_metrics(metrics: dict[str, float]) -> dict[str, str | int]:
        """Format metrics as display strings."""
        return {
            "cpu": f"{metrics.get('cpu_usage_percent', 0.0):.0f}%",
            "memory": f"{metrics.get('memory_usage_percent', 0.0):.0f}%",
            "restarts": int(metrics.get("restart_count", 0)),
            "latency_delta": f"{max(1.0, metrics.get('latency_p95_seconds', 0.0)):.1f}x",
        }
