from __future__ import annotations

import asyncio
import shlex
import subprocess

from collectors.k8s_events_collector import K8sEventsCollector
from collectors.loki_collector import LokiCollector
from collectors.prometheus_collector import PrometheusCollector
from collectors.tempo_collector import TempoCollector
from incident.snapshot_builder import SnapshotBuilder
from models.schemas import IncidentSnapshot
from signal_intelligence.metric_feature_builder import MetricFeatureBuilder
from classification.failure_classifier import FailureClassifier


class FaultInjector:
    def __init__(self, scenarios: list[dict]) -> None:
        self.scenarios = {scenario["scenario_id"]: scenario for scenario in scenarios}

    def apply_fault(self, scenario_id: str) -> None:
        scenario = self.scenarios[scenario_id]
        command = scenario["k8s_fault_action"]
        args = shlex.split(command)
        if not args or args[0] != "kubectl":
            raise RuntimeError("Fault command rejected: only kubectl commands are allowed")

        result = subprocess.run(args, shell=False, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"Fault command failed (exit {result.returncode}): {result.stderr.strip()}")
        return None

    async def collect_snapshot(
        self,
        scenario_id: str,
        snapshot_id: str,
        prometheus: PrometheusCollector,
        loki: LokiCollector,
        k8s_events: K8sEventsCollector,
        tempo: TempoCollector,
    ) -> IncidentSnapshot:
        scenario = self.scenarios[scenario_id]
        settle_seconds = int(scenario.get("fault_settle_seconds", 30))
        await asyncio.sleep(settle_seconds)

        namespace = scenario["namespace"]
        deployment = scenario["deployment"]
        service = scenario["service"]
        pod_name = scenario.get("pod")

        if not pod_name:
            # Fallback path: use deployment label to resolve first pod.
            pods = k8s_events.v1.list_namespaced_pod(namespace=namespace, label_selector=f"app={deployment}")
            pod_name = pods.items[0].metadata.name if pods.items else f"{deployment}-unknown"

        metrics = await prometheus.get_incident_metrics(namespace=namespace, pod=pod_name)
        baseline = await prometheus.get_baseline_samples(namespace=namespace, pod=pod_name, samples=10)
        features = MetricFeatureBuilder().build(metrics, baseline)

        events = k8s_events.get_deployment_events(namespace=namespace, deployment=deployment, window_minutes=5)
        logs_summary = await loki.get_log_signatures(namespace=namespace, service=service)

        latency_delta = 1.0
        if baseline:
            baseline_latency = max(float(baseline[-1].get("latency_p95_seconds", 0.001)), 0.001)
            latency_delta = float(metrics.get("latency_p95_seconds", 0.0)) / baseline_latency
        metrics["latency_delta_x"] = latency_delta

        timeout_count = sum(
            int(item.get("count", 0))
            for item in logs_summary
            if "timeout" in str(item.get("signature", "")).lower()
        )
        trace_summary = None
        if tempo.should_query(
            latency_delta_x=latency_delta,
            timeout_log_count=timeout_count,
            cross_service_suspected=False,
            rule_confidence=0.0,
            failure_class="unknown",
        ):
            trace_summary = {
                "enabled": True,
                "suspected_path": f"{service} -> dependencies",
                "hot_span": "pending",
                "p95_ms": int(float(metrics.get("latency_p95_seconds", 0.0)) * 1000),
            }

        failure_class = FailureClassifier().classify(events, features, logs_summary)

        # Reuse monitor confidence formula without re-running collection.
        from agents.monitor_agent import compute_monitor_confidence

        monitor_confidence = compute_monitor_confidence(
            metric_anomaly=bool(features.get("memory_usage_percent", {}).get("anomaly", False)
                                or features.get("cpu_usage_percent", {}).get("anomaly", False)
                                or features.get("latency_p95_seconds", {}).get("anomaly", False)),
            metric_severity="critical" if float(metrics.get("memory_usage_percent", 0.0)) >= 95 else "warn",
            event_reasons=[str(event.get("reason", "")) for event in events],
            log_signature_count=len(logs_summary),
            z_score=float(features.get("memory_usage_percent", {}).get("z_score", 0.0)),
        )

        snapshot = SnapshotBuilder().build(
            incident_id=snapshot_id,
            alert=f"{failure_class} detected on {service}",
            service=service,
            pod=pod_name,
            namespace=namespace,
            deployment=deployment,
            metrics=metrics,
            events=events,
            logs=logs_summary,
            trace_summary=trace_summary,
            failure_class=failure_class,
            confidence=monitor_confidence,
            dependency_graph_summary=f"{service} -> dependencies",
        )
        return snapshot
