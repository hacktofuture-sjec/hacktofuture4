from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import agents.live_monitor_agent as live_monitor_module


class _DummyDb:
    def execute(self, *args, **kwargs):
        return self

    def commit(self):
        return None

    def close(self):
        return None


def test_upsert_enriches_existing_open_incident(monkeypatch):
    original = deepcopy(live_monitor_module.INCIDENTS)
    live_monitor_module.INCIDENTS[:] = [
        {
            "incident_id": "inc-test-1",
            "service": "auth-service",
            "status": "open",
            "failure_class": "application_crash",
            "severity": "low",
            "monitor_confidence": 0.0,
            "created_at": "2026-04-16T19:00:00+00:00",
            "updated_at": "2026-04-16T19:00:00+00:00",
            "scope": {"namespace": "prod", "deployment": "auth-service"},
            "namespace": "prod",
            "pod": "auth-service-1",
            "scenario_id": "crash-loop-001",
            "snapshot": {
                "alert": "application_crash detected on auth-service",
                "pod": "auth-service-1",
                "metrics": {"cpu": "0%", "memory": "1%", "restarts": 0, "latency_delta": "1.0x"},
                "events": [],
                "logs_summary": [],
                "trace_summary": None,
                "scope": {"namespace": "prod", "deployment": "auth-service"},
                "monitor_confidence": 0.0,
                "failure_class": "application_crash",
                "dependency_graph_summary": "auth-service -> dependencies",
            },
            "diagnosis": {"source": "rule", "root_cause": "unknown", "confidence": 0.0},
            "plan": None,
            "execution": None,
            "verification": None,
            "token_summary": None,
            "resolved_at": None,
            "dependency_graph_summary": "auth-service -> dependencies",
            "summary": "application_crash detected on auth-service",
        }
    ]

    dummy_db = _DummyDb()
    monkeypatch.setattr(live_monitor_module, "get_db", lambda: dummy_db)

    try:
        agent = live_monitor_module.LiveMonitorAgent()
        incident = {
            "incident_id": "inc-new",
            "service": "auth-service",
            "status": "open",
            "failure_class": "config_error",
            "severity": "medium",
            "monitor_confidence": 0.85,
            "created_at": "2026-04-16T19:05:00+00:00",
            "updated_at": "2026-04-16T19:05:00+00:00",
            "scope": {"namespace": "prod", "deployment": "auth-service"},
            "namespace": "prod",
            "pod": "auth-service-1",
            "scenario_id": "crash-loop-001",
            "snapshot": {
                "alert": "application_crash detected on auth-service",
                "pod": "auth-service-1",
                "metrics": {"cpu": "0%", "memory": "1%", "restarts": 4, "latency_delta": "1.0x"},
                "events": [{"reason": "CrashLoopBackOff", "message": "backoff", "count": 2}],
                "logs_summary": [{"signature": "imagepullbackoff", "count": 1}],
                "trace_summary": None,
                "scope": {"namespace": "prod", "deployment": "auth-service"},
                "monitor_confidence": 0.85,
                "failure_class": "config_error",
                "dependency_graph_summary": "auth-service -> dependencies",
            },
        }

        agent._upsert_incident_record(incident=incident, diagnosis={"source": "rule", "root_cause": "application crash"})

        assert len(live_monitor_module.INCIDENTS) == 1
        updated = live_monitor_module.INCIDENTS[0]
        assert updated["monitor_confidence"] == 0.85
        assert updated["failure_class"] == "config_error"
        assert len(updated["snapshot"]["events"]) == 1
        assert len(updated["snapshot"]["logs_summary"]) == 1
        assert updated["diagnosis"]["root_cause"] == "application crash"
        assert updated["updated_at"] != updated["created_at"]
    finally:
        live_monitor_module.INCIDENTS[:] = original


def test_explicit_scenario_signal_detects_cpu_stress_pod(monkeypatch):
    agent = live_monitor_module.LiveMonitorAgent()
    agent.k8s_events.v1 = None

    assert agent._has_explicit_scenario_signal(
        scenario_id="cpu-spike-001",
        namespace="prod",
        deployment="api-service",
        events=[{"reason": "BackOff", "message": "cpu-stress pod detected"}],
        logs=[],
    ) is True


def test_explicit_scenario_signal_detects_db_readiness_failure(monkeypatch):
    agent = live_monitor_module.LiveMonitorAgent()
    agent.k8s_events.v1 = None

    assert agent._has_explicit_scenario_signal(
        scenario_id="db-latency-001",
        namespace="prod",
        deployment="payment-api",
        events=[{"reason": "Unhealthy", "message": "Readiness probe failed: HTTP probe failed with statuscode: 503"}],
        logs=[],
    ) is True


def test_explicit_scenario_signal_detects_oom_memory_limit(monkeypatch):
    agent = live_monitor_module.LiveMonitorAgent()

    class _Container:
        def __init__(self):
            self.resources = type(
                "Resources",
                (),
                {
                    "limits": {"memory": "30Mi"},
                    "requests": {"memory": "16Mi"},
                },
            )()

    class _Deployment:
        def __init__(self):
            self.spec = type(
                "Spec",
                (),
                {
                    "template": type(
                        "Template",
                        (),
                        {"spec": type("PodSpec", (), {"containers": [_Container()]})()},
                    )()
                },
            )()

    class _Core:
        def read_namespaced_deployment(self, name, namespace):
            return _Deployment()

    agent.k8s_events.v1 = _Core()

    assert agent._has_explicit_scenario_signal(
        scenario_id="oom-kill-001",
        namespace="prod",
        deployment="payment-api",
        events=[],
        logs=[],
    ) is True
