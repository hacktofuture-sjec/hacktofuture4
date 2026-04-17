"""
Tests for planner policy ranker and token governor.
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from planner.policy_ranker import lookup_policy, rank_actions_by_risk, POLICY_CATALOG
from governance.token_governor import TokenGovernor, TokenBudget


def test_policy_lookup_oom():
    """Test policy lookup for OOM (FP-001)."""
    actions = lookup_policy("FP-001")
    assert actions is not None, "FP-001 should have policy actions"
    assert len(actions) >= 1, "Should have at least one action"
    commands = [action["command"] for action in actions]
    assert any("rollout restart" in command for command in commands), "Expected restart action"


def test_policy_lookup_crash_loop():
    """Test policy lookup for CrashLoop (FP-002)."""
    actions = lookup_policy("FP-002")
    assert actions is not None, "FP-002 should have policy actions"
    assert "rollout undo" in actions[0]["command"], "Expected rollback action"


def test_policy_lookup_unknown():
    """Test policy lookup for unknown fingerprint."""
    actions = lookup_policy("FP-999")
    assert actions is None, "Unknown fingerprint should return None"


def test_action_ranking_by_risk():
    """Test action ranking by risk level."""
    actions = [
        {"action_id": "a1", "risk": "high", "blast_radius_score": 0.5},
        {"action_id": "a2", "risk": "low", "blast_radius_score": 0.1},
        {"action_id": "a3", "risk": "medium", "blast_radius_score": 0.2},
    ]
    ranked = rank_actions_by_risk(actions)
    assert ranked[0]["risk"] == "low", "Lowest risk should be first"
    assert ranked[1]["risk"] == "medium", "Medium risk should be second"
    assert ranked[2]["risk"] == "high", "High risk should be last"


def test_token_governor_initialization():
    """Test TokenGovernor initialization."""
    budget = TokenBudget(max_calls_per_incident=2, max_estimated_cost_usd=0.10)
    gov = TokenGovernor(budget=budget, model="gpt-3.5-turbo")
    assert gov.calls_this_incident == 0, "Should start with 0 calls"
    assert gov.cost_this_incident == 0.0, "Should start with 0 cost"


def test_token_estimation():
    """Test token estimation."""
    gov = TokenGovernor()
    text = "This is a test incident snapshot with many words for token counting purposes."
    tokens = gov.estimate_tokens(text)
    assert tokens > 0, "Token count should be positive"
    assert tokens < len(text), "Token count should be less than char count"


def test_cost_calculation():
    """Test cost estimation."""
    gov = TokenGovernor(model="gpt-3.5-turbo")
    input_tokens = 100
    output_tokens = 50
    cost = gov.estimate_cost(input_tokens, output_tokens)
    assert cost > 0, "Cost should be positive"
    assert cost < 0.01, "Small token count should have low cost"


def test_budget_gate():
    """Test budget gate enforcement."""
    budget = TokenBudget(max_calls_per_incident=2, max_estimated_cost_usd=0.01)
    gov = TokenGovernor(budget=budget)

    # First call should pass
    assert gov.can_afford_ai_call(0.005), "First call within budget should pass"

    # Record the call
    gov.record_ai_call(100, 100, 0.005, 0.005)

    # Second call should pass
    assert gov.can_afford_ai_call(0.004), "Second call within budget should pass"
    gov.record_ai_call(100, 100, 0.004, 0.004)

    # Third call should fail (max calls reached)
    assert not gov.can_afford_ai_call(0.001), "Third call should exceed max_calls limit"


def test_budget_gate_cost_limit():
    """Test cost budget enforcement."""
    budget = TokenBudget(max_calls_per_incident=10, max_estimated_cost_usd=0.01)
    gov = TokenGovernor(budget=budget)

    # Record expensive calls
    gov.record_ai_call(1000, 1000, 0.015, 0.015)

    # Next call should fail (budget exceeded)
    assert not gov.can_afford_ai_call(0.001), "Should exceed cost budget"


def test_rule_confidence_fallback():
    """Test fallback to rule-only when confidence is high."""
    gov = TokenGovernor()
    
    # High confidence should trigger fallback
    assert gov.should_fallback_to_rule_only(0.95), "High confidence should fallback to rule-only"
    
    # Low confidence but within budget should allow AI
    gov2 = TokenGovernor(budget=TokenBudget(max_calls_per_incident=5, max_estimated_cost_usd=0.50))
    assert not gov2.should_fallback_to_rule_only(0.50), "Low confidence with budget should allow AI"


def test_reset_incident():
    """Test incident counter reset."""
    gov = TokenGovernor()
    gov.record_ai_call(100, 100, 0.005, 0.005)
    assert gov.calls_this_incident == 1, "Should have 1 call"
    
    gov.reset_incident()
    assert gov.calls_this_incident == 0, "Should reset to 0"
    assert gov.cost_this_incident == 0.0, "Cost should reset to 0"
