"""
Action Orchestrator Agent — Handles natural language text and executes actions.
This is the core of the Proactive PM USP!

Supports two execution modes (controlled by MCP_LIVE env var):
  - Mock mode (default): Safe for demos, returns simulated success responses
  - Live mode: Calls actual Jira/Slack APIs via MCP server functions
"""

import logging
import os
from typing import Any, Dict, List

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ..config import settings
from ..schemas import ActionItemData, ActionResult

logger = logging.getLogger(__name__)

MCP_LIVE = settings.mcp_live


class ActionItem(BaseModel):
    tool: str = Field(
        description="The tool name, exactly one of: 'jira', 'slack', 'linear'"
    )
    action: str = Field(description="The name of the action to execute.")
    payload: Dict[str, Any] = Field(
        description="The relevant data payload for the action."
    )


class ActionPlannerSchema(BaseModel):
    """Structured output for the LLM to decide what actions to take."""

    analysis: str = Field(description="Brief explanation of what needs to be done.")
    actions: List[ActionItem] = Field(description="List of exact actions to take.")


SYSTEM_PROMPT = """You are the core of an Autonomous Proactive Product Manager.

The user will provide natural language text (e.g. checking in standup updates, reporting a bug).
Your job is to parse this text, determine what actions need to occur across various platforms,
and output a structured plan.

AVAILABLE TOOLS:
- jira: [create_ticket, transition_status, update_ticket, search_issues]
  - create_ticket payload: {{project_key, summary, issue_type, description, priority, labels}}
  - transition_status payload: {{issue_key, transition_name}}
  - search_issues payload: {{jql}}
- slack: [send_message]
  - send_message payload: {{channel, text}}
- linear: [create_issue, update_issue]
  - create_issue payload: {{title, description, priority, team}}

RULES:
1. Be precise — only emit actions the user explicitly or implicitly requested.
2. For Jira transitions, use standard status names: To Do, In Progress, Done.
3. For Jira searches, output valid JQL based on the user's intent.
3. For Slack messages, compose a helpful, professional message.
4. Include ALL relevant details from the user's input in the payloads.
"""


async def _execute_mock(tool: str, action: str, payload: dict) -> str:
    """Mock MCP execution — safe for live demos."""
    logger.info("[MCP MOCK] Executing %s -> %s with payload %s", tool, action, payload)
    if tool == "jira" and action == "create_ticket":
        return (
            f"Created Jira ticket '{payload.get('summary', 'Untitled')}' "
            f"in {payload.get('project_key', 'PROJ')}"
        )
    elif tool == "jira" and action == "transition_status":
        return (
            f"Transitioned {payload.get('issue_key', '???')} to "
            f"'{payload.get('transition_name', '???')}'"
        )
    elif tool == "slack" and action == "send_message":
        return f"Sent message to Slack channel {payload.get('channel', '#general')}"
    else:
        return f"Executed {action} on {tool}"


import importlib.util


def _load_mcp_server(provider: str):
    path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__), f"../../../mcp-servers/{provider}/src/server.py"
        )
    )
    spec = importlib.util.spec_from_file_location(f"mcp_{provider}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _execute_live(tool: str, action: str, payload: dict) -> str:
    """Live MCP execution — calls real Jira/Slack APIs."""
    try:
        if tool == "jira":
            jira_mod = _load_mcp_server("jira")
            if action == "create_ticket":
                result = await jira_mod.create_issue(
                    project_key=payload.get("project_key", "PROJ"),
                    summary=payload.get("summary", "Untitled"),
                    issue_type=payload.get("issue_type", "Task"),
                    description=payload.get("description", ""),
                    priority=payload.get("priority", "Medium"),
                    labels=payload.get("labels", []),
                )
                return f"Created Jira issue {result.get('key', '???')}"

            elif action == "transition_status":
                result = await jira_mod.transition_issue(
                    issue_key=payload.get("issue_key", ""),
                    transition_name=payload.get("transition_name", "Done"),
                )
                return f"Transitioned {result.get('issue_key')} to {result.get('transitioned_to')}"

            elif action == "search_issues":
                result = await jira_mod.search_issues(
                    jql=payload.get("jql", "project = PROJ ORDER BY created DESC"),
                )
                if isinstance(result, list):
                    count = len(result)
                else:
                    count = len(result.get("issues", []))
                return f"Successfully fetched {count} issues matching your search from Jira."

        elif tool == "slack" and action == "send_message":
            slack_mod = _load_mcp_server("slack")
            result = await slack_mod.send_message(
                channel_id=payload.get("channel", ""),
                text=payload.get("text", ""),
            )
            return f"Sent Slack message (ts={result.get('ts', '???')})"

        return await _execute_mock(tool, action, payload)

    except Exception as exc:
        logger.error("[MCP LIVE] Failed %s.%s: %s", tool, action, exc)
        # Graceful fallback to mock on failure
        return f"[FALLBACK] {await _execute_mock(tool, action, payload)} (Error: {str(exc)})"


async def run_action_orchestrator(text: str) -> ActionResult:
    """Takes text, orchestrates LLM, and executes MCP calls (mock or live)."""
    llm_kwargs = {
        "model": settings.llm_model,
        "temperature": settings.llm_temperature,
        "api_key": settings.openai_api_key,
        "timeout": 60,
    }
    if settings.openai_api_base_url:
        llm_kwargs["base_url"] = settings.openai_api_base_url

    llm = ChatOpenAI(**llm_kwargs)

    structured_llm = llm.with_structured_output(ActionPlannerSchema)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", "User Input: {input_text}")]
    )

    chain = prompt | structured_llm

    mode = "LIVE" if MCP_LIVE else "MOCK"
    logger.info("[action_orchestrator] [%s] Analyzing text: %s", mode, text)

    try:
        plan: ActionPlannerSchema = await chain.ainvoke({"input_text": text})
    except Exception as exc:
        logger.error("LLM failure in orchestrator: %s", exc)
        return ActionResult(
            original_text=text,
            actions_taken=[],
            success=False,
            message="Failed to parse intent via LLM.",
        )

    actions_taken = []
    executor = _execute_live if MCP_LIVE else _execute_mock

    for act in plan.actions:
        tool = act.tool
        action = act.action
        payload = act.payload

        result_msg = await executor(tool, action, payload)

        actions_taken.append(
            ActionItemData(
                tool=tool,
                action=action,
                details=payload,
                status="success",
                message=result_msg,
            )
        )

    return ActionResult(
        original_text=text,
        actions_taken=actions_taken,
        success=True,
        message=plan.analysis,
    )
