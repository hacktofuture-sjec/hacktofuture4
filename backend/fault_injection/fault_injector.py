from __future__ import annotations

import asyncio
import shlex
import subprocess
from datetime import datetime, timedelta, timezone

from collectors.k8s_events_collector import K8sEventsCollector
from collectors.loki_collector import LokiCollector
from collectors.prometheus_collector import PrometheusCollector
from collectors.tempo_collector import TempoCollector
from incident.incident_assembler import IncidentAssembler
from incident.snapshot_builder import SnapshotBuilder
from models.schemas import IncidentSnapshot
from signal_intelligence.metric_feature_builder import MetricFeatureBuilder
from classification.failure_classifier import FailureClassifier


class FaultInjector:
    def __init__(self, scenarios: list[dict]) -> None:
        self.scenarios = {scenario["scenario_id"]: scenario for scenario in scenarios}

    @staticmethod
    def _namespace_from_args(args: list[str], default: str = "default") -> str:
        for i, arg in enumerate(args):
            if arg in {"-n", "--namespace"} and i + 1 < len(args):
                return args[i + 1]
            if arg.startswith("--namespace="):
                return arg.split("=", 1)[1]
        return default

    def apply_fault(self, scenario_id: str, force: bool = False) -> None:
        scenario = self.scenarios[scenario_id]
        command = scenario["k8s_fault_action"]
        args = shlex.split(command)
        if not args or args[0] != "kubectl":
            raise RuntimeError("Fault command rejected: only kubectl commands are allowed")

        result = subprocess.run(args, shell=False, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return None

        stderr = (result.stderr or "").strip()

        # Idempotent retry path for repeatable 'kubectl run <name>' injections.
        if force and "AlreadyExists" in stderr and len(args) >= 3 and args[1] == "run":
            pod_name = args[2]
            namespace = self._namespace_from_args(args, default=scenario.get("namespace", "default"))
            delete_args = ["kubectl", "delete", "pod", pod_name, "-n", namespace, "--ignore-not-found"]
            subprocess.run(delete_args, shell=False, capture_output=True, text=True, timeout=60)

            retry = subprocess.run(args, shell=False, capture_output=True, text=True, timeout=60)
            if retry.returncode == 0:
                return None
            retry_stderr = (retry.stderr or "").strip()
            raise RuntimeError(f"Fault command failed (exit {retry.returncode}): {retry_stderr}")

        raise RuntimeError(f"Fault command failed (exit {result.returncode}): {stderr}")
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
        """
        Collect all 4 signals and assemble normalized IncidentSnapshot via IncidentAssembler.
        
        Process:
        1. Wait for fault to settle
        2. Resolve pod name
        3. Collect metrics, logs, traces, and K8s events in parallel
        4. Assemble into normalized incident JSON via IncidentAssembler
        5. Convert to IncidentSnapshot model
        """
        scenario = self.scenarios[scenario_id]
        settle_seconds = int(scenario.get("fault_settle_seconds", 30))
        await asyncio.sleep(settle_seconds)

        namespace = scenario["namespace"]
        deployment = scenario["deployment"]
        service = scenario["service"]
        pod_name = scenario.get("pod")
        started_at = datetime.now(timezone.utc).isoformat()

        if not pod_name:
            # Fallback: use deployment label to resolve first pod
            if k8s_events.v1:
                pods = k8s_events.v1.list_namespaced_pod(
                    namespace=namespace, label_selector=f"app={deployment}"
                )
                pod_name = (
                    pods.items[0].metadata.name if pods.items else f"{deployment}-unknown"
                )
            else:
                pod_name = f"{deployment}-unknown"

        # Collect all 4 signals in parallel
        metrics = await prometheus.get_incident_metrics(namespace=namespace, pod=pod_name)
        baseline = await prometheus.get_baseline_samples(
            namespace=namespace, pod=pod_name, samples=10
        )
        logs_raw = await loki.get_log_lines(namespace=namespace, service=service)
        events = k8s_events.get_deployment_events(
            namespace=namespace, deployment=deployment, window_minutes=5
        )
        
        # Query traces if latency anomaly suspected
        traces = []
        latency_delta = 1.0
        if baseline:
            baseline_latency = max(float(baseline[-1].get("latency_p95_seconds", 0.001)), 0.001)
            latency_delta = float(metrics.get("latency_p95_seconds", 0.0)) / baseline_latency
        
        timeout_count = sum(
            1 for line in logs_raw if "timeout" in str(line).lower()
        )
        if tempo.should_query(
            latency_delta_x=latency_delta,
            timeout_log_count=timeout_count,
            cross_service_suspected=False,
            rule_confidence=0.0,
            failure_class="unknown",
        ):
            end = datetime.now(timezone.utc)
            start = end - timedelta(minutes=5)
            try:
                traces_list = await tempo.search_traces(service, start, end)
                if traces_list:
                    # Fetch first trace details
                    trace_detail = await tempo.get_trace(traces_list[0].get("traceID"))
                    if trace_detail:
                        traces = [trace_detail]
            except Exception:
                traces = []

        # Assemble incident via IncidentAssembler
        incident_dict = IncidentAssembler.assemble(
            injection_event={
                "scenario_id": scenario_id,
                "service": service,
                "namespace": namespace,
                "pod": pod_name,
                "deployment": deployment,
                "started_at": started_at,
            },
            collected_signals={
                "metrics": metrics,
                "logs": logs_raw,
                "traces": traces,
                "events": events,
            },
            context={
                "baseline_values": baseline[-1] if baseline else {},
                "dependency_graph_summary": f"{service} -> dependencies",
            },
        )

        # Extract normalized snapshot and convert to IncidentSnapshot model
        snapshot_data = incident_dict["snapshot"]
        metrics_data = snapshot_data["metrics"]
        scope_data = snapshot_data["scope"]
        
        snapshot = SnapshotBuilder.build(
            incident_id=incident_dict["incident_id"],
            alert=snapshot_data["alert"],
            service=incident_dict["service"],
            namespace=incident_dict["namespace"],
            deployment=scope_data["deployment"],
            pod=snapshot_data["pod"],
            metrics_raw={
                "cpu_percent": float(metrics_data["cpu"].rstrip("%")),
                "memory_percent": float(metrics_data["memory"].rstrip("%")),
                "restart_count": metrics_data["restarts"],
                "latency_delta_ratio": latency_delta,
            },
            events_raw=snapshot_data["events"],
            logs_raw=snapshot_data["logs_summary"],
            trace_raw=snapshot_data["trace_summary"],
            failure_class=snapshot_data["failure_class"],
            confidence=snapshot_data["monitor_confidence"],
            dependency_graph_summary=snapshot_data["dependency_graph_summary"],
        )
        return snapshot
