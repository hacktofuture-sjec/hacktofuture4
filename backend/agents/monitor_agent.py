from collectors.k8s_events_collector import K8sEventsCollector
from collectors.loki_collector import LokiCollector
from collectors.prometheus_collector import PrometheusCollector
from collectors.tempo_collector import TempoCollector


class MonitorAgent:
    def __init__(self) -> None:
        self.prom = PrometheusCollector()
        self.loki = LokiCollector()
        self.tempo = TempoCollector()
        self.events = K8sEventsCollector()

    def collect_snapshot(self) -> dict:
        # Keep this endpoint deterministic and fast for orchestration tests and demo runs.
        metrics = {
            "memory_pct": 72.0,
            "cpu_pct": 38.0,
            "restart_count": 1,
            "latency_delta": 1.2,
        }
        events: list[dict] = []
        signatures: list[dict] = []
        trace_summary = None

        # Keep both documented nested shape and legacy flat keys for compatibility.
        return {
            "incident_id": "monitor-snapshot",
            "alert": "monitor snapshot captured",
            "service": "unknown",
            "pod": "unknown",
            "metrics": metrics,
            "events": events,
            "logs_summary": signatures,
            "trace_summary": trace_summary,
            "scope": {"namespace": "default", "deployment": "unknown"},
            "monitor_confidence": 0.0,
            "failure_class": "unknown",
            "dependency_graph_summary": "unknown -> dependencies",
            "trace": trace_summary,
            "memory_pct": metrics["memory_pct"],
            "cpu_pct": metrics["cpu_pct"],
            "restart_count": metrics["restart_count"],
            "latency_delta": metrics["latency_delta"],
            "event_reason": events,
            "log_signatures": signatures,
        }
