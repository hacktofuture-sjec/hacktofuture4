"""
Action Orchestrator Agent tests.

Tests the autonomous NL → action pipeline WITHOUT real LLM calls.
All LLM interactions are mocked to test schema handling and routing.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas import ActionItemData, ActionResult

# ── Schema validation tests ──────────────────────────────────────────────────


def test_action_request_schema_requires_text():
    """ActionRequest must have text and organization_id."""
    from src.schemas import ActionRequest

    req = ActionRequest(text="fix the bug", organization_id="org-1")
    assert req.text == "fix the bug"
    assert req.organization_id == "org-1"
    assert req.user_id is None


def test_action_request_schema_with_user_id():
    """ActionRequest accepts optional user_id."""
    from src.schemas import ActionRequest

    req = ActionRequest(text="deploy it", organization_id="org-1", user_id="user-42")
    assert req.user_id == "user-42"


def test_action_result_schema_roundtrip():
    """ActionResult serializes and deserializes correctly."""
    result = ActionResult(
        original_text="test",
        actions_taken=[
            ActionItemData(
                tool="jira",
                action="create_ticket",
                details={"title": "Bug fix"},
                status="success",
                message="Created PROJ-1",
            )
        ],
        success=True,
        message="Done",
    )
    data = result.model_dump()
    assert data["success"] is True
    assert len(data["actions_taken"]) == 1
    assert data["actions_taken"][0]["tool"] == "jira"


def test_action_item_data_schema():
    """ActionItemData validates all required fields."""
    item = ActionItemData(
        tool="slack",
        action="send_message",
        details={"channel": "#general", "text": "Hello"},
        status="success",
        message="Message sent",
    )
    assert item.tool == "slack"
    assert item.details["channel"] == "#general"


# ── Orchestrator logic tests (mocked LLM) ────────────────────────────────────


@pytest.mark.asyncio
async def test_orchestrator_returns_action_result_on_success():
    """Orchestrator should return ActionResult with actions on LLM success."""
    from src.agents.action_orchestrator import (
        ActionPlannerSchema,
        run_action_orchestrator,
    )

    mock_plan = ActionPlannerSchema(
        analysis="User wants to close a Jira ticket and notify Slack.",
        actions=[
            {
                "tool": "jira",
                "action": "transition_status",
                "payload": {"ticket_id": "PROJ-1", "status": "resolved"},
            },
            {
                "tool": "slack",
                "action": "send_message",
                "payload": {"channel": "#dev", "text": "PROJ-1 resolved"},
            },
        ],
    )

    mock_chain = MagicMock()
    mock_chain.ainvoke = AsyncMock(return_value=mock_plan)

    with patch("src.agents.action_orchestrator.ChatOpenAI"):
        with patch("src.agents.action_orchestrator.ChatPromptTemplate") as MockPrompt:
            MockPrompt.from_messages.return_value.__or__ = MagicMock(
                return_value=mock_chain
            )

            result = await run_action_orchestrator("Close PROJ-1 and tell the team")

    assert isinstance(result, ActionResult)
    assert result.success is True
    assert len(result.actions_taken) == 2
    assert result.actions_taken[0].tool == "jira"
    assert result.actions_taken[0].action == "transition_status"
    assert result.actions_taken[1].tool == "slack"


@pytest.mark.asyncio
async def test_orchestrator_handles_llm_failure_gracefully():
    """If LLM call fails, orchestrator returns failure result without crashing."""
    from src.agents.action_orchestrator import run_action_orchestrator

    mock_chain = MagicMock()
    mock_chain.ainvoke = AsyncMock(side_effect=Exception("LLM timeout"))

    with patch("src.agents.action_orchestrator.ChatOpenAI"):
        with patch("src.agents.action_orchestrator.ChatPromptTemplate") as MockPrompt:
            MockPrompt.from_messages.return_value.__or__ = MagicMock(
                return_value=mock_chain
            )

            result = await run_action_orchestrator("Something complex")

    assert isinstance(result, ActionResult)
    assert result.success is False
    assert result.actions_taken == []
    assert "Failed" in result.message


@pytest.mark.asyncio
async def test_orchestrator_handles_empty_actions():
    """If LLM returns zero actions, result should still be valid."""
    from src.agents.action_orchestrator import (
        ActionPlannerSchema,
        run_action_orchestrator,
    )

    mock_plan = ActionPlannerSchema(
        analysis="No actionable items found in input.",
        actions=[],
    )

    mock_chain = MagicMock()
    mock_chain.ainvoke = AsyncMock(return_value=mock_plan)

    with patch("src.agents.action_orchestrator.ChatOpenAI"):
        with patch("src.agents.action_orchestrator.ChatPromptTemplate") as MockPrompt:
            MockPrompt.from_messages.return_value.__or__ = MagicMock(
                return_value=mock_chain
            )

            result = await run_action_orchestrator("Just saying hi")

    assert result.success is True
    assert len(result.actions_taken) == 0
    assert result.message == "No actionable items found in input."


# ── Pipeline endpoint tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_action_endpoint_returns_200():
    """POST /pipeline/action should return 200 with valid ActionResult."""
    from httpx import ASGITransport, AsyncClient

    from src.main import app

    mock_result = ActionResult(
        original_text="do something",
        actions_taken=[
            ActionItemData(
                tool="jira",
                action="create_ticket",
                details={"title": "New bug"},
                status="success",
                message="Created",
            )
        ],
        success=True,
        message="Analyzed.",
    )

    with patch(
        "src.agents.action_orchestrator.run_action_orchestrator",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/pipeline/action",
                json={"text": "do something", "organization_id": "org-test"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["actions_taken"]) == 1
    assert data["original_text"] == "do something"


@pytest.mark.asyncio
async def test_action_endpoint_requires_text():
    """POST /pipeline/action should return 422 when text is missing."""
    from httpx import ASGITransport, AsyncClient

    from src.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/pipeline/action",
            json={"organization_id": "org-test"},
        )

    assert response.status_code == 422
