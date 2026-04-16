"""
Mapper agent — LLM-powered normalization of raw provider payload → UnifiedTicketSchema.

Uses LangChain's with_structured_output to enforce strict JSON.
Feeds validation errors back into the prompt on retry attempts.
"""

import logging
from typing import Any, Dict, List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from ..config import settings
from ..schemas import UnifiedTicketSchema

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a data normalization expert for a Product Intelligence Platform.

Your job is to map raw ticket data from provider APIs (Jira, Linear, GitHub, HubSpot, Slack)
into a strict unified schema.

RULES:
1. Output ONLY valid JSON matching the schema — no explanations, no markdown fences.
2. normalized_status MUST be exactly one of: open, in_progress, blocked, resolved
3. normalized_type MUST be one of: bug, feature, task, epic, story, subtask, other
4. priority MUST be one of: critical, high, medium, low, none
5. If a field cannot be determined, use null (not empty string).
6. due_date must be ISO-8601 date format (YYYY-MM-DD) or null.
7. external_ticket_id and title are REQUIRED — never null or empty.
8. If there are previous validation errors, you MUST fix them explicitly.
"""

HUMAN_PROMPT = """Provider: {source}

Raw payload:
{raw_payload}

{error_section}

Map this to the unified ticket schema."""


def _format_error_section(validation_errors: List[str]) -> str:
    if not validation_errors:
        return ""
    errors_str = "\n".join(f"  - {e}" for e in validation_errors)
    return f"""
PREVIOUS VALIDATION ERRORS (you must fix these):
{errors_str}

Ensure your output corrects all the above errors.
"""


async def run_mapper(
    raw_payload: Dict[str, Any],
    source: str,
    validation_errors: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Calls LLM to normalize raw_payload → UnifiedTicketSchema.
    Returns the mapped data as a dict.
    """
    llm = ChatOpenAI(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        api_key=settings.openai_api_key,
        timeout=60,
    )

    # Structured output enforces JSON schema validation
    structured_llm = llm.with_structured_output(UnifiedTicketSchema)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ]
    )

    chain = prompt | structured_llm

    import json

    error_section = _format_error_section(validation_errors or [])

    logger.debug(
        "[mapper] Invoking LLM model=%s source=%s errors=%s",
        settings.llm_model,
        source,
        len(validation_errors or []),
    )

    result: UnifiedTicketSchema = await chain.ainvoke(
        {
            "source": source,
            "raw_payload": json.dumps(raw_payload, indent=2, default=str),
            "error_section": error_section,
        }
    )

    mapped = result.model_dump()
    logger.debug("[mapper] Mapped result: %s", mapped)
    return mapped
