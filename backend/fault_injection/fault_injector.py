import hashlib
from uuid import uuid4

from models.enums import FailureClass
from models.schemas import EventRecord, IncidentScope, IncidentSnapshot, LogSignature, MetricSummary


class FaultInjector:
    def __init__(self, scenarios: list[dict]):
        self.scenarios = {scenario["scenario_id"]: scenario for scenario in scenarios}

    def build_snapshot(self, scenario_id: str) -> IncidentSnapshot:
        scenario = self.scenarios[scenario_id]
        incident_id = f"inc-{uuid4().hex[:8]}"

        service = scenario["service"]
        namespace = scenario["namespace"]
        deployment = scenario.get("deployment", service)
        pod_hash = hashlib.sha1(service.encode("utf-8")).hexdigest()[:5]
        pod = f"{deployment}-{pod_hash}"

        failure_class = FailureClass(scenario["failure_class"])
        snapshot = IncidentSnapshot(
            incident_id=incident_id,
            alert=f"{failure_class.value} detected on {service}",
            service=service,
            pod=pod,
            metrics=MetricSummary(cpu="65%", memory="78%", restarts=1, latency_delta="1.4x"),
            events=[
                EventRecord(
                    reason="FaultInjected",
                    message=f"Scenario {scenario_id} injected",
                    count=1,
                    pod=pod,
                    namespace=namespace,
                    type="Warning",
                )
            ],
            logs_summary=[LogSignature(signature="fault injection marker", count=1)],
            trace_summary=None,
            scope=IncidentScope(namespace=namespace, deployment=deployment),
            monitor_confidence=0.75,
            failure_class=failure_class,
            dependency_graph_summary=f"{service} -> dependencies (pending deeper signal collection)",
        )
        return snapshot
