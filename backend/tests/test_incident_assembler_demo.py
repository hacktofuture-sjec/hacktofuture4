"""
IncidentAssembler Demo: End-to-end incident normalization from 4-signal collection.

Run this to validate IncidentAssembler workflow with all 4 signals (metrics, logs, traces, events).
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from incident.incident_assembler import IncidentAssembler


def demo_oom_kill_incident():
    """Demo: OOMKilled scenario with memory signal + K8s events + logs."""
    print("\n=== Demo 1: OOMKilled Scenario ===\n")
    
    # Injection context
    injection_event = {
        "scenario_id": "oom-kill-001",
        "service": "payment-api",
        "namespace": "prod",
        "pod": "payment-api-6f5d",
        "deployment": "payment-api",
        "started_at": (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat(),
    }
    
    # Collected signals
    now = datetime.now(timezone.utc)
    collected_signals = {
        "metrics": {
            "memory_usage_percent": 95.2,
            "cpu_usage_percent": 45.0,
            "restart_count": 2.0,
            "latency_p95_seconds": 0.85,
            "error_rate_rps": 2.1,
        },
        "logs": [
            "memory pressure: OOMKilled process 1234",
            "container killed due to out of memory",
            "Killing container payment 1234",
            "memory cgroup out of memory: Killed process",
        ],
        "traces": [],  # No traces for OOM scenario
        "events": [
            {
                "reason": "OOMKilled",
                "message": "Container payment killed due to memory pressure",
                "count": 1,
                "first_seen": (now - timedelta(seconds=30)).isoformat(),
                "last_seen": (now - timedelta(seconds=20)).isoformat(),
                "pod": "payment-api-6f5d",
                "namespace": "prod",
                "type": "Warning",
            },
            {
                "reason": "BackOff",
                "message": "Back-off restarting failed container",
                "count": 2,
                "first_seen": (now - timedelta(seconds=45)).isoformat(),
                "pod": "payment-api-6f5d",
                "namespace": "prod",
                "type": "Warning",
            },
        ],
    }
    
    # Baseline context
    context = {
        "baseline_values": {
            "memory_usage_percent": 72.0,
            "cpu_usage_percent": 38.0,
            "restart_count": 0.0,
            "latency_p95_seconds": 0.1,
        },
        "dependency_graph_summary": "frontend -> payment-api -> postgresql",
    }
    
    # Assemble incident
    incident = IncidentAssembler.assemble(injection_event, collected_signals, context)
    
    print(json.dumps(incident, indent=2))
    
    # Validate
    assert incident["scenario_id"] == "oom-kill-001"
    assert incident["severity"] == "high"
    assert incident["snapshot"]["failure_class"] == "resource_exhaustion"
    assert incident["snapshot"]["monitor_confidence"] > 0.7
    assert len(incident["snapshot"]["logs_summary"]) > 0
    assert len(incident["snapshot"]["events"]) > 0
    
    print("\n✓ OOMKilled scenario validated")


def demo_cpu_spike_scenario():
    """Demo: CPU spike scenario with high CPU metrics."""
    print("\n=== Demo 2: CPU Spike Scenario ===\n")
    
    injection_event = {
        "scenario_id": "cpu-spike-001",
        "service": "api-service",
        "namespace": "prod",
        "pod": "api-service-xyz9",
        "deployment": "api-service",
        "started_at": (datetime.now(timezone.utc) - timedelta(seconds=45)).isoformat(),
    }
    
    now = datetime.now(timezone.utc)
    collected_signals = {
        "metrics": {
            "memory_usage_percent": 52.0,
            "cpu_usage_percent": 92.5,  # High CPU
            "restart_count": 0.0,
            "latency_p95_seconds": 2.3,
            "error_rate_rps": 8.4,
        },
        "logs": [
            "request timeout after 2000ms",
            "slow query detected: SELECT * FROM orders took 3500ms",
            "thread pool exhausted",
        ],
        "traces": [
            {
                "resourceSpans": [
                    {
                        "scopeSpans": [
                            {
                                "spans": [
                                    {
                                        "name": "GET /api/orders",
                                        "startTimeUnixNano": int(now.timestamp() * 1e9),
                                        "endTimeUnixNano": int((now + timedelta(milliseconds=2300)).timestamp() * 1e9),
                                    },
                                    {
                                        "name": "db.query",
                                        "startTimeUnixNano": int((now + timedelta(milliseconds=100)).timestamp() * 1e9),
                                        "endTimeUnixNano": int((now + timedelta(milliseconds=2100)).timestamp() * 1e9),
                                    },
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        "events": [
            {
                "reason": "BackOff",
                "message": "Back-off restarting failed container",
                "count": 1,
                "first_seen": (now - timedelta(seconds=20)).isoformat(),
                "pod": "api-service-xyz9",
                "namespace": "prod",
                "type": "Warning",
            }
        ],
    }
    
    context = {
        "baseline_values": {
            "memory_usage_percent": 48.0,
            "cpu_usage_percent": 25.0,
            "restart_count": 0.0,
            "latency_p95_seconds": 0.15,
        },
        "dependency_graph_summary": "client -> api-service -> slow-db",
    }
    
    incident = IncidentAssembler.assemble(injection_event, collected_signals, context)
    
    print(json.dumps(incident, indent=2))
    
    # Validate
    assert incident["scenario_id"] == "cpu-spike-001"
    assert incident["severity"] in ("high", "medium")  # Depends on confidence calculation
    # Latency + timeout logs -> dependency_failure
    assert incident["snapshot"]["failure_class"] in ("resource_exhaustion", "dependency_failure")
    assert incident["snapshot"]["trace_summary"] is not None
    assert incident["snapshot"]["trace_summary"]["p95_ms"] > 0
    assert incident["snapshot"]["monitor_confidence"] >= 0.6  # Should be moderate-high
    
    print("\n✓ CPU spike scenario validated")


def demo_config_error_scenario():
    """Demo: ImagePullBackOff config error."""
    print("\n=== Demo 3: Config Error (ImagePullBackOff) ===\n")
    
    injection_event = {
        "scenario_id": "bad-image-tag",
        "service": "worker",
        "namespace": "prod",
        "pod": "worker-abc1",
        "deployment": "worker",
        "started_at": (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat(),
    }
    
    now = datetime.now(timezone.utc)
    collected_signals = {
        "metrics": {
            "memory_usage_percent": 0.0,
            "cpu_usage_percent": 0.0,
            "restart_count": 0.0,
            "latency_p95_seconds": 0.0,
            "error_rate_rps": 0.0,
        },
        "logs": [],
        "traces": [],
        "events": [
            {
                "reason": "ImagePullBackOff",
                "message": "Failed to pull image 'myregistry.azurecr.io/worker:invalid-tag': rpc error: image not found",
                "count": 3,
                "first_seen": (now - timedelta(seconds=25)).isoformat(),
                "pod": "worker-abc1",
                "namespace": "prod",
                "type": "Warning",
            },
            {
                "reason": "BackOff",
                "message": "Back-off pulling image",
                "count": 3,
                "first_seen": (now - timedelta(seconds=25)).isoformat(),
                "pod": "worker-abc1",
                "namespace": "prod",
                "type": "Warning",
            },
        ],
    }
    
    context = {
        "baseline_values": {},
        "dependency_graph_summary": "queue -> worker",
    }
    
    incident = IncidentAssembler.assemble(injection_event, collected_signals, context)
    
    print(json.dumps(incident, indent=2))
    
    # Validate
    assert incident["scenario_id"] == "bad-image-tag"
    assert incident["severity"] in ("low", "medium")
    assert incident["snapshot"]["failure_class"] == "config_error"
    assert incident["snapshot"]["monitor_confidence"] >= 0.5
    assert len(incident["snapshot"]["logs_summary"]) > 0
    
    print("\n✓ Config error scenario validated")


if __name__ == "__main__":
    try:
        demo_oom_kill_incident()
        demo_cpu_spike_scenario()
        demo_config_error_scenario()
        print("\n" + "=" * 60)
        print("✓ All IncidentAssembler demos passed!")
        print("=" * 60 + "\n")
    except Exception as e:
        print(f"\n✗ Demo failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


def test_failed_event_message_is_normalized_to_imagepull_reason():
    now = datetime.now(timezone.utc)
    incident = IncidentAssembler.assemble(
        injection_event={
            "scenario_id": "crash-loop-001",
            "service": "auth-service",
            "namespace": "prod",
            "pod": "auth-service-abc",
            "deployment": "auth-service",
            "started_at": (now - timedelta(seconds=30)).isoformat(),
        },
        collected_signals={
            "metrics": {
                "memory_usage_percent": 1.0,
                "cpu_usage_percent": 0.0,
                "restart_count": 0.0,
                "latency_p95_seconds": 0.0,
                "error_rate_rps": 0.0,
            },
            "logs": [],
            "traces": [],
            "events": [
                {
                    "reason": "Failed",
                    "message": "Error: ImagePullBackOff",
                    "count": 4,
                    "first_seen": (now - timedelta(seconds=20)).isoformat(),
                    "last_seen": (now - timedelta(seconds=5)).isoformat(),
                    "pod": "auth-service-abc",
                    "namespace": "prod",
                    "type": "Warning",
                }
            ],
        },
        context={"baseline_values": {}, "dependency_graph_summary": "auth-service -> dependencies"},
    )

    reasons = [event.get("reason") for event in incident["snapshot"]["events"]]
    assert "ImagePullBackOff" in reasons
    assert incident["snapshot"]["monitor_confidence"] >= 0.5
