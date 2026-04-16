"""
Validator agent — deterministic Python validation (NO LLM).

Validates:
  1. normalized_status ∈ {open, in_progress, blocked, resolved}
  2. due_date is valid ISO-8601 YYYY-MM-DD or null
  3. external_ticket_id is non-empty string
  4. title is non-empty string
  5. assignee_external_id exists in Django identity map (if provided)
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from ..django_client import get_identity_map

logger = logging.getLogger(__name__)

VALID_STATUSES = {"open", "in_progress", "blocked", "resolved"}
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


async def run_validator(
    mapped_data: Dict[str, Any],
    integration_id: int,
) -> Tuple[bool, List[str]]:
    """
    Validates mapped_data against deterministic rules.
    Returns (is_valid, errors).
    """
    errors: List[str] = []

    # ── Rule 1: external_ticket_id required ─────────────────────────────────
    ext_id = mapped_data.get("external_ticket_id")
    if not ext_id or not str(ext_id).strip():
        errors.append("external_ticket_id is required and must be non-empty.")

    # ── Rule 2: title required ───────────────────────────────────────────────
    title = mapped_data.get("title")
    if not title or not str(title).strip():
        errors.append("title is required and must be non-empty.")

    # ── Rule 3: normalized_status ────────────────────────────────────────────
    status = mapped_data.get("normalized_status")
    if not status or status not in VALID_STATUSES:
        errors.append(
            f"normalized_status must be one of {sorted(VALID_STATUSES)}, got '{status}'."
        )

    # ── Rule 4: due_date ISO-8601 ────────────────────────────────────────────
    due_date = mapped_data.get("due_date")
    if due_date is not None and not ISO_DATE_RE.match(str(due_date)):
        errors.append(
            f"due_date must be ISO-8601 format (YYYY-MM-DD) or null, got '{due_date}'."
        )

    # ── Rule 5: assignee identity exists in Django ───────────────────────────
    assignee_external_id = mapped_data.get("assignee_external_id")
    if assignee_external_id:
        try:
            identity = await get_identity_map(
                integration_id=integration_id,
                external_user_id=str(assignee_external_id),
            )
            if not identity.get("found"):
                # Non-blocking warning — identity may not be synced yet
                logger.warning(
                    "[validator] assignee_external_id='%s' not found in identity map "
                    "(integration=%s). Will persist with null assignee.",
                    assignee_external_id,
                    integration_id,
                )
                # Clear the unresolved ID to avoid FK violation
                mapped_data["assignee_external_id"] = None
        except Exception as exc:
            logger.warning(
                "[validator] Identity map lookup failed: %s — skipping assignee check.", exc
            )

    is_valid = len(errors) == 0

    if is_valid:
        logger.info("[validator] Validation passed.")
    else:
        logger.warning("[validator] Validation failed: %s", errors)

    return is_valid, errors
