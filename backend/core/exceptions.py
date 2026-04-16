"""
Custom exception handling for the platform DRF API.

Returns a consistent JSON shape:
  { "error": "...", "detail": "...", "code": "..." }
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class OrganizationNotFound(Exception):
    pass


class IntegrationNotConfigured(Exception):
    pass


class IdempotencyConflict(Exception):
    """Raised when a request with a duplicate idempotency key arrives."""

    def __init__(self, cached_response=None):
        self.cached_response = cached_response
        super().__init__("Idempotency key already used.")


def custom_exception_handler(exc, context):
    """
    Wraps DRF's default exception handler to add a consistent error envelope
    and log unexpected errors with full context.
    """
    response = exception_handler(exc, context)

    if response is None:
        # Unhandled exception — log and return 500
        logger.exception(
            "Unhandled server error",
            extra={
                "view": str(context.get("view")),
                "request_path": context.get("request", {}).path
                if hasattr(context.get("request"), "path")
                else "",
            },
        )
        return Response(
            {
                "error": "internal_server_error",
                "detail": "An unexpected error occurred.",
                "code": "server_error",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Normalise the response body into our envelope
    error_detail = response.data
    if isinstance(error_detail, dict):
        detail = error_detail.get("detail", str(error_detail))
    elif isinstance(error_detail, list):
        detail = error_detail[0] if error_detail else "Unknown error"
    else:
        detail = str(error_detail)

    if isinstance(exc, Http404):
        code = "not_found"
        error = "not_found"
    elif isinstance(exc, PermissionDenied):
        code = "permission_denied"
        error = "permission_denied"
    else:
        code = getattr(exc, "default_code", "error")
        error = code

    response.data = {
        "error": error,
        "detail": str(detail),
        "code": code,
    }

    return response
