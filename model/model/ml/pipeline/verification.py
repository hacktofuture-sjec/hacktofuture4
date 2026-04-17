"""
verification.py
----------------
Stage 9: Post-Heal Verification Layer

After a remediation action is taken, this module simulates a verification
check to determine if the action was successful.

In production, this would query live telemetry after a wait period.
For the hackathon demo, we simulate "after" telemetry based on the action taken.
"""

import random
import copy


def _simulate_post_heal_telemetry(telemetry: dict, action: str) -> dict:
    """
    Simulate what telemetry might look like after a remediation action.
    In production, this would be a real re-check after a delay.
    """
    after = copy.deepcopy(telemetry)

    if action == "SCALE_DEPLOYMENT":
        # Scaling should reduce CPU, latency, and connections per pod
        after["replicas"] = min(after["replicas"] + 2, 10)
        after["available_replicas"] = after["replicas"]
        after["cpu_percent"] = max(10, after["cpu_percent"] * 0.5)
        after["latency_ms"] = max(20, after["latency_ms"] * 0.4)
        after["active_connections"] = max(10, int(after["active_connections"] * 0.4))
        after["is_reachable"] = 1

    elif action == "RESTART_POD":
        # Restart should clear crash loops and reduce errors
        after["restart_count"] = 0
        after["error_count"] = max(0, int(after["error_count"] * 0.2))
        after["available_replicas"] = after["replicas"]
        after["latency_ms"] = max(30, after["latency_ms"] * 0.5)
        after["is_reachable"] = 1

    elif action == "DRAIN_NODE":
        after["active_connections"] = max(5, int(after["active_connections"] * 0.3))
        after["cpu_percent"] = max(10, after["cpu_percent"] * 0.6)

    # Add slight randomness to simulate real-world variance
    for key in ["cpu_percent", "latency_ms", "memory_mb"]:
        if key in after:
            noise = random.uniform(0.9, 1.15)
            after[key] = round(after[key] * noise, 1)

    return after


def verify_healing(telemetry_before: dict, action: str) -> dict:
    """
    Verify whether a remediation action was successful.

    Args:
        telemetry_before: telemetry snapshot before the action
        action:           the remediation action that was taken

    Returns:
        dict with verification status, before/after comparison, and checks.
    """
    # For NO_ACTION or ALERT_ONLY, no verification needed
    if action in ("NO_ACTION", "ALERT_ONLY"):
        return {
            "status": "skipped",
            "reason": "No remediation action was taken",
            "checks": {},
        }

    # Simulate post-heal telemetry
    after = _simulate_post_heal_telemetry(telemetry_before, action)

    # Run verification checks
    checks = {}

    # Check 1: Latency improvement
    lat_before = telemetry_before.get("latency_ms", 0)
    lat_after = after.get("latency_ms", 0)
    checks["latency_reduced"] = lat_after < lat_before * 0.8

    # Check 2: Restarts stopped
    checks["restarts_cleared"] = after.get("restart_count", 0) < telemetry_before.get("restart_count", 0)

    # Check 3: Replicas recovered
    checks["replicas_healthy"] = (
        after.get("available_replicas", 0) >= after.get("replicas", 1)
    )

    # Check 4: Service reachable
    checks["service_reachable"] = after.get("is_reachable", 0) == 1

    # Check 5: CPU stabilised
    checks["cpu_stabilised"] = after.get("cpu_percent", 100) < 75

    # Overall verdict: success if majority of relevant checks pass
    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    success = passed >= (total * 0.6)  # 60% of checks must pass

    return {
        "status": "success" if success else "failed",
        "checks_passed": f"{passed}/{total}",
        "checks": checks,
        "telemetry_after": after,
    }
