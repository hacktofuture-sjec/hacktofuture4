"""
Action Orchestrator Agent — Handles natural language text and executes actions.
This is the core of the Proactive PM USP!
"""

import logging
from typing import Any, Dict, List

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ..config import settings
from ..schemas import ActionItemData, ActionResult

logger = logging.getLogger(__name__)


class ActionPlannerSchema(BaseModel):
    """Structured output for the LLM to decide what actions to take."""

    analysis: str = Field(description="Brief explanation of what needs to be done.")
    actions: List[Dict[str, Any]] = Field(
        description="List of exact actions to take. Each dict must contain "
        "'tool' (e.g. jira, slack), 'action' (e.g. update_ticket, create_ticket, "
        "send_message) and 'payload' (relevant data)."
    )


SYSTEM_PROMPT = """You are the core of an Autonomous Proactive Product Manager.

The user will provide natural language text (e.g. checking in standup updates, reporting a bug).
Your job is to parse this text, determine what actions need to occur across various platforms,
and output a structured plan.

AVAILABLE TOOLS:
- jira: [update_ticket, create_ticket, transition_status]
- slack: [send_message, alert_user]
- linear: [create_issue, update_issue]

Read the user input, deduce constraints (like moving a block to someone else, moving ticket status),
and output the JSON mapping of exact tools and payloads.
"""


async def run_action_orchestrator(text: str) -> ActionResult:
    """Takes text, orchestrates LLM, and mocks MCP calls."""
    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        api_key=settings.openai_api_key,
        timeout=60,
    )

    structured_llm = llm.with_structured_output(ActionPlannerSchema)
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", "User Input: {input_text}")]
    )

    chain = prompt | structured_llm

    logger.info("[action_orchestrator] Analyzing text: %s", text)
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

    # Mocking MCP execution sequentially
    for act in plan.actions:
        tool = act.get("tool", "unknown")
        action = act.get("action", "unknown")
        payload = act.get("payload", {})

        # MOCK EXECUTION BLOCK
        logger.info(
            "[MCP MOCK] Executing %s -> %s with payload %s", tool, action, payload
        )

        # In a real MCP setup, we would call the fastmcp client here.
        # For the demo safely, we return a successful mock response.
        if tool == "jira":
            result_msg = f"Successfully executed '{action}' in Jira."
        elif tool == "slack":
            result_msg = f"Successfully pinged relevant users in Slack."
        else:
            result_msg = f"Executed {action} on {tool}."

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
