"""
safety.py
---------
Stage 8: Safety / Policy Layer

Applies guardrails before any auto-remediation action is executed.
  - Maximum replica limits
  - Confidence thresholds
  - Cooldown windows between actions
  - Action-specific constraints
"""

import time

# -- Policy configuration ------------------------------------------------------
MAX_REPLICAS = 10
MIN_CONFIDENCE_FOR_ACTION = 0.70
COOLDOWN_SECONDS = 120  # 2 minutes between auto-actions

# In-memory cooldown tracker (service_name -> last_action_timestamp)
_action_history: dict[str, float] = {}


def apply_safety_policies(decision: dict, telemetry: dict,
                          service_name: str = "target-service") -> dict:
    """
    Apply safety guardrails to a proposed remediation decision.

    Args:
        decision:     dict from decision engine (action, reason, confidence_level, auto_remediate)
        telemetry:    validated telemetry dict
        service_name: service being remediated

    Returns:
        Updated decision dict with:
          - original_action:  what was proposed
          - final_action:     what will actually execute (may be overridden)
          - policy_overrides: list of policies that modified the action
          - safe_to_execute:  bool
    """
    original_action = decision["action"]
    final_action = original_action
    overrides = []

    # Policy 1: No auto-action below confidence threshold
    if decision.get("auto_remediate") and decision["confidence_level"] == "low":
        final_action = "ALERT_ONLY"
        overrides.append(
            f"Confidence too low for auto-remediation (need >= {MIN_CONFIDENCE_FOR_ACTION})"
        )

    # Policy 2: Max replica limit for scale actions
    if final_action == "SCALE_DEPLOYMENT":
        current_replicas = telemetry.get("replicas", 1)
        if current_replicas >= MAX_REPLICAS:
            final_action = "ALERT_ONLY"
            overrides.append(
                f"Cannot scale beyond {MAX_REPLICAS} replicas "
                f"(current: {current_replicas})"
            )

    # Policy 3: Cooldown between auto-actions on same service
    if final_action not in ("NO_ACTION", "ALERT_ONLY"):
        last_action_time = _action_history.get(service_name, 0)
        elapsed = time.time() - last_action_time
        if elapsed < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - elapsed)
            final_action = "ALERT_ONLY"
            overrides.append(
                f"Cooldown active: {remaining}s remaining before next auto-action"
            )

    # Policy 4: Don't restart pods if all replicas are already down
    if final_action == "RESTART_POD":
        available = telemetry.get("available_replicas", 0)
        replicas = telemetry.get("replicas", 1)
        if available == 0 and replicas > 0:
            # Scale instead of restart when nothing is running
            final_action = "SCALE_DEPLOYMENT"
            overrides.append(
                "No available replicas, switching from RESTART to SCALE"
            )

    # Determine if safe to auto-execute
    safe = (
        final_action not in ("NO_ACTION", "ALERT_ONLY")
        and len([o for o in overrides if "Cannot" in o or "Cooldown" in o]) == 0
    )

    # Record this action for cooldown tracking
    if safe and final_action not in ("NO_ACTION", "ALERT_ONLY"):
        _action_history[service_name] = time.time()

    return {
        "original_action": original_action,
        "final_action": final_action,
        "policy_overrides": overrides,
        "safe_to_execute": safe,
        "reason": decision["reason"],
    }
