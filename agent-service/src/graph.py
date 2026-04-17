"""
LangGraph pipeline graph — the core of the AI processing pipeline.

Graph topology:
  START → fetcher → mapper → validator → (conditional) → persist | send_to_dlq → END

Routing:
  validator → persist       : is_valid=True
  validator → mapper        : is_valid=False AND attempt_count < 3  (self-healing retry)
  validator → send_to_dlq   : attempt_count >= 3
"""

import logging
import uuid
from typing import Any, Dict

from langgraph.graph import END, START, StateGraph

from .agents.mapper import run_mapper
from .agents.validator import run_validator
from .django_client import post_dlq, upsert_ticket
from .schemas import TicketState

logger = logging.getLogger(__name__)


# ── Node implementations ────────────────────────────────────────────────────


async def fetcher_node(state: TicketState) -> Dict[str, Any]:
    """
    Fetcher node — receives raw payload already in state.
    In a full sync flow, this would fetch from MCP server.
    For webhook flow, payload is already provided.
    """
    logger.info(
        "[fetcher] Processing event_id=%s source=%s",
        state["event_id"],
        state["source"],
    )
    # Payload is already in state from pipeline trigger
    return {"raw_payload": state["raw_payload"]}


async def mapper_node(state: TicketState) -> Dict[str, Any]:
    """
    LLM Mapper node — normalizes raw payload to UnifiedTicketSchema.
    If validation_errors exist in state, feeds them back to LLM for correction.
    """
    logger.info(
        "[mapper] Mapping event_id=%s attempt=%s",
        state["event_id"],
        state["attempt_count"],
    )

    try:
        mapped_data = await run_mapper(
            raw_payload=state["raw_payload"],
            source=state["source"],
            validation_errors=state.get("validation_errors", []),
        )
        return {
            "mapped_data": mapped_data,
            "attempt_count": state["attempt_count"],
        }
    except Exception as exc:
        logger.exception("[mapper] LLM call failed: %s", exc)
        return {
            "mapped_data": None,
            "validation_errors": [f"Mapper LLM error: {str(exc)}"],
        }


async def validator_node(state: TicketState) -> Dict[str, Any]:
    """
    Deterministic Python validator — no LLM involved.
    Validates normalized_status, due_date, external_ticket_id.
    """
    logger.info(
        "[validator] Validating event_id=%s attempt=%s",
        state["event_id"],
        state["attempt_count"],
    )

    if not state.get("mapped_data"):
        return {
            "is_valid": False,
            "validation_errors": [
                "mapped_data is empty — mapper failed to produce output"
            ],
            "attempt_count": state["attempt_count"] + 1,
        }

    is_valid, errors = await run_validator(
        mapped_data=state["mapped_data"],
        integration_id=state["integration_id"],
    )

    return {
        "is_valid": is_valid,
        "validation_errors": errors,
        "attempt_count": state["attempt_count"] + 1,
    }


async def persist_node(state: TicketState) -> Dict[str, Any]:
    """
    Persist node — calls Django /tickets/upsert API.
    This is the ONLY place DB writes happen (via Django, not direct).
    """
    logger.info("[persist] Upserting ticket for event_id=%s", state["event_id"])

    try:
        result = await upsert_ticket(
            {
                **state["mapped_data"],
                "organization_id": state["organization_id"],
                "integration_id": state["integration_id"],
                "processing_run_id": state.get("processing_run_id"),
            }
        )
        logger.info(
            "[persist] Ticket upserted: ticket_id=%s created=%s",
            result.get("ticket_id"),
            result.get("created"),
        )
        return {"is_valid": True}
    except Exception as exc:
        logger.exception("[persist] Failed to upsert ticket: %s", exc)
        return {}


async def dlq_node(state: TicketState) -> Dict[str, Any]:
    """
    DLQ node — called when attempt_count >= 3.
    Sends event to Django DLQ endpoint for investigation.
    """
    logger.error(
        "[dlq] Sending event_id=%s to DLQ after %s attempts",
        state["event_id"],
        state["attempt_count"],
    )

    try:
        await post_dlq(
            event_id=state["event_id"],
            failure_reason="Exceeded max mapper retry attempts (3).",
            error_trace={
                "validation_errors": state.get("validation_errors", []),
                "mapped_data": state.get("mapped_data"),
                "attempt_count": state["attempt_count"],
            },
            retry_count=state["attempt_count"],
        )
    except Exception as exc:
        logger.exception("[dlq] Failed to write to DLQ: %s", exc)

    return {}


# ── Routing logic ────────────────────────────────────────────────────────────


def route_after_validator(state: TicketState) -> str:
    """
    Route decision after validator:
      - attempt_count >= 3  → send_to_dlq
      - is_valid=True        → persist
      - is_valid=False       → mapper (retry with error feedback)
    """
    if state["attempt_count"] >= 3:
        logger.warning(
            "[router] Max attempts reached for event_id=%s → DLQ",
            state["event_id"],
        )
        return "send_to_dlq"

    if state["is_valid"]:
        return "persist"

    logger.info(
        "[router] Invalid mapping for event_id=%s attempt=%s → retry mapper",
        state["event_id"],
        state["attempt_count"],
    )
    return "mapper"


# ── Graph assembly ───────────────────────────────────────────────────────────


def build_graph() -> StateGraph:
    """Assembles and compiles the LangGraph pipeline."""
    graph = StateGraph(TicketState)

    # Register nodes
    graph.add_node("fetcher", fetcher_node)
    graph.add_node("mapper", mapper_node)
    graph.add_node("validator", validator_node)
    graph.add_node("persist", persist_node)
    graph.add_node("send_to_dlq", dlq_node)

    # Define edges
    graph.add_edge(START, "fetcher")
    graph.add_edge("fetcher", "mapper")
    graph.add_edge("mapper", "validator")

    # Conditional routing from validator
    graph.add_conditional_edges(
        "validator",
        route_after_validator,
        {
            "persist": "persist",
            "mapper": "mapper",
            "send_to_dlq": "send_to_dlq",
        },
    )

    graph.add_edge("persist", END)
    graph.add_edge("send_to_dlq", END)

    return graph.compile()


# Singleton compiled graph — reused across requests
pipeline_graph = build_graph()


async def run_pipeline(
    event_id: int,
    source: str,
    raw_payload: Dict[str, Any],
    organization_id: str,
    integration_id: int,
    processing_run_id: str = None,
) -> Dict[str, Any]:
    """
    Entry point to invoke the LangGraph pipeline.
    Returns the final state.
    """
    initial_state: TicketState = {
        "raw_payload": raw_payload,
        "source": source,
        "organization_id": organization_id,
        "integration_id": integration_id,
        "event_id": event_id,
        "attempt_count": 1,
        "mapped_data": None,
        "validation_errors": [],
        "is_valid": False,
        "processing_run_id": processing_run_id or str(uuid.uuid4()),
    }

    logger.info(
        "Starting pipeline: event_id=%s source=%s org=%s",
        event_id,
        source,
        organization_id,
    )

    final_state = await pipeline_graph.ainvoke(initial_state)
    return final_state
