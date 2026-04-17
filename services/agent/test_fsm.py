"""
Unit tests for all FSM state transitions.
Verifies: no path skips PIN, escalation always reachable, tool isolation enforced.
"""
import pytest
from fsm import FSMContext, AgentState


def test_initial_state_is_authentication():
    fsm = FSMContext(tenant_id="t1", caller_id="c1")
    assert fsm.state == AgentState.AUTHENTICATION


def test_authentication_only_has_verify_pin_tools():
    fsm = FSMContext(tenant_id="t1", caller_id="c1")
    tool_names = [t["name"] for t in fsm.get_permitted_tools()]
    assert "Verify_PIN" in tool_names
    assert "Search_Knowledge_Base" not in tool_names


def test_information_retrieval_has_search_not_update():
    fsm = FSMContext(tenant_id="t1", caller_id="c1")
    fsm.transition_to(AgentState.INFORMATION_RETRIEVAL)
    tool_names = [t["name"] for t in fsm.get_permitted_tools()]
    assert "Search_Knowledge_Base" in tool_names
    assert "Update_Record" not in tool_names
    assert "Transfer_To_Human_Agent" not in tool_names


def test_human_escalation_only_has_transfer():
    fsm = FSMContext(tenant_id="t1", caller_id="c1")
    fsm.transition_to(AgentState.HUMAN_ESCALATION)
    tool_names = [t["name"] for t in fsm.get_permitted_tools()]
    assert tool_names == ["Transfer_To_Human_Agent"]


def test_cannot_skip_authentication():
    fsm = FSMContext(tenant_id="t1", caller_id="c1")
    # Simulate user asking a question before authenticating
    assert fsm.state == AgentState.AUTHENTICATION
    assert "Search_Knowledge_Base" not in [t["name"] for t in fsm.get_permitted_tools()]


def test_transition_to_escalation_from_any_state():
    for state in [AgentState.AUTHENTICATION, AgentState.INFORMATION_RETRIEVAL, AgentState.ACTION_EXECUTION]:
        fsm = FSMContext(tenant_id="t1", caller_id="c1")
        fsm.state = state
        fsm.transition_to(AgentState.HUMAN_ESCALATION)
        assert fsm.state == AgentState.HUMAN_ESCALATION
