#!/usr/bin/env python3
"""
Unit test for the new /diagnose endpoint integration.
This tests the data contract without needing Kubernetes or monitoring services.
"""

import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from incident.store import INCIDENTS
from agents.monitor_agent import MonitorAgent
from agents.phase3_orchestrator import diagnose_snapshot, plan_diagnosis
from models.schemas import IncidentSnapshot, DiagnosisPayload

def test_snapshot_collection():
    """Test that monitor agent produces correctly shaped snapshot."""
    print("\n→ Testing monitor snapshot collection")
    
    monitor = MonitorAgent()
    snapshot = monitor.collect_snapshot()
    assert isinstance(snapshot, dict), "Snapshot should be a dict"
    
    # Check documented fields
    required_fields = [
        "incident_id", "alert", "service", "pod", "scope",
        "monitor_confidence", "failure_class", "metrics",
        "events", "logs_summary"
    ]
    
    for field in required_fields:
        assert field in snapshot, f"Snapshot missing {field}"
    
    print(f"✓ Snapshot contains all required fields")
    print(f"  - incident_id: {snapshot['incident_id']}")
    print(f"  - failure_class: {snapshot['failure_class']}")
    print(f"  - monitor_confidence: {snapshot['monitor_confidence']}")
    return snapshot


def test_diagnosis(snapshot):
    """Test that diagnose_snapshot produces correctly shaped diagnosis."""
    print("\n→ Testing diagnosis with DiagnoseAgent")
    
    diagnosis = diagnose_snapshot(snapshot)
    assert isinstance(diagnosis, dict), "Diagnosis should be a dict"
    
    # Check documented fields
    required_fields = [
        "root_cause", "confidence", "diagnosis_mode",
        "fingerprint_matched", "affected_services", "evidence"
    ]
    
    for field in required_fields:
        assert field in diagnosis, f"Diagnosis missing {field}"
    
    assert isinstance(diagnosis["confidence"], (int, float)), "Confidence should be numeric"
    assert 0.0 <= diagnosis["confidence"] <= 1.0, "Confidence should be between 0 and 1"
    assert diagnosis["diagnosis_mode"] in ["rule", "ai"], "Diagnosis mode should be 'rule' or 'ai'"
    assert isinstance(diagnosis["affected_services"], list), "Affected services should be a list"
    
    print(f"✓ Diagnosis has all required fields")
    print(f"  - root_cause: {diagnosis['root_cause']}")
    print(f"  - confidence: {diagnosis['confidence']:.2f}")
    print(f"  - diagnosis_mode: {diagnosis['diagnosis_mode']}")
    print(f"  - fingerprint_matched: {diagnosis['fingerprint_matched']}")
    return diagnosis


def test_plan(snapshot, diagnosis):
    """Test that plan_diagnosis produces correctly shaped plan."""
    print("\n→ Testing planning with PlannerAgent")
    
    context = {
        "dependency_graph_summary": "service -> db",
        "has_rollback_revision": True,
        "namespace": "default",
        "deployment": "sample-app"
    }
    
    plan_output = plan_diagnosis(diagnosis, context)
    assert isinstance(plan_output, dict), "Plan output should be a dict"
    
    # Check documented fields
    assert "actions" in plan_output, "Plan should have actions"
    assert isinstance(plan_output["actions"], list), "Actions should be a list"
    assert len(plan_output["actions"]) > 0, "Plan should have at least one action"
    
    # Check action structure
    required_action_fields = [
        "command", "description", "risk_level", "expected_outcome",
        "confidence", "approval_required"
    ]
    
    for action in plan_output["actions"]:
        for field in required_action_fields:
            assert field in action, f"Action missing {field}"
        
        assert isinstance(action["confidence"], (int, float)), f"Action confidence should be numeric"
        assert 0.0 <= action["confidence"] <= 1.0, "Action confidence should be between 0 and 1"
        assert action["risk_level"] in ["low", "medium", "high"], "Risk level should be low/medium/high"
        assert isinstance(action["approval_required"], bool), "Approval required should be bool"
    
    print(f"✓ Plan has all required fields")
    print(f"  - Total actions: {len(plan_output['actions'])}")
    for i, action in enumerate(plan_output["actions"][:2]):  # Show first 2
        print(f"    [{i}] {action['command']} (risk: {action['risk_level']})")
    
    return plan_output


def test_end_to_end():
    """Test the complete monitor -> diagnose -> plan pipeline."""
    print("=" * 70)
    print("Testing Monitor -> Diagnose -> Plan Pipeline (Unit Tests)")
    print("=" * 70)
    
    try:
        # Test snapshot collection
        snapshot = test_snapshot_collection()
        
        # Test diagnosis
        diagnosis = test_diagnosis(snapshot)
        
        # Test planning
        plan = test_plan(snapshot, diagnosis)
        
        print("\n" + "=" * 70)
        print("✓ All unit tests passed!")
        print("=" * 70)
        return True
        
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_end_to_end()
    sys.exit(0 if success else 1)
