from __future__ import annotations

from models.schemas import EventRecord, IncidentScope, IncidentSnapshot, LogSignature, MetricSummary, TraceSummary


class SnapshotBuilder:
    @staticmethod
    def build(
        incident_id: str,
        alert: str,
        service: str,
        namespace: str,
        deployment: str,
        pod: str,
        metrics_raw: dict,
        events_raw: list[dict],
        logs_raw: list[dict],
        trace_raw: dict | None,
        failure_class: str,
        confidence: float,
        dependency_graph_summary: str,
    ) -> IncidentSnapshot:
        metrics = MetricSummary(
            cpu=f"{metrics_raw.get('cpu_percent', 0):.0f}%",
            memory=f"{metrics_raw.get('memory_percent', 0):.0f}%",
            restarts=int(metrics_raw.get("restart_count", 0)),
            latency_delta=f"{metrics_raw.get('latency_delta_ratio', 1.0):.1f}x",
        )

        events = [EventRecord(**event) for event in events_raw]
        logs_summary = [LogSignature(**entry) for entry in logs_raw]
        trace_summary = TraceSummary(**trace_raw) if trace_raw else None

        return IncidentSnapshot(
            incident_id=incident_id,
            alert=alert,
            service=service,
            pod=pod,
            metrics=metrics,
            events=events,
            logs_summary=logs_summary,
            trace_summary=trace_summary,
            scope=IncidentScope(namespace=namespace, deployment=deployment),
            monitor_confidence=max(0.0, min(1.0, confidence)),
            failure_class=failure_class,
            dependency_graph_summary=dependency_graph_summary,
        )
