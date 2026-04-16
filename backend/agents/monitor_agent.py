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
        metrics = {
            "memory_pct": self.prom.query_instant("memory_usage_percent").get("value", 0.0),
            "cpu_pct": self.prom.query_instant("cpu_usage_percent").get("value", 0.0),
            "restart_count": self.prom.query_instant("pod_restart_count").get("value", 0.0),
            "latency_delta": self.prom.query_instant("latency_delta_multiplier").get("value", 0.0),
        }
        events = self.events.list_recent_events().get("events", [])
        signatures = self.loki.query_logs("{app=\"payment-api\"} |= \"error\"").get("signatures", [])
        trace = self.tempo.get_trace_summary("trace-stub")

        # Keep both nested and flat keys while Phase 3 is integrated.
        return {
            "metrics": metrics,
            "events": events,
            "logs_summary": signatures,
            "trace": trace,
            "memory_pct": metrics["memory_pct"],
            "cpu_pct": metrics["cpu_pct"],
            "restart_count": metrics["restart_count"],
            "latency_delta": metrics["latency_delta"],
            "event_reason": events,
            "log_signatures": signatures,
        }
