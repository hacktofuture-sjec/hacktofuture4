"""
Platform-wide pagination classes.
"""

from rest_framework.pagination import CursorPagination, PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """Default pagination: page-based, 50 per page, max 200."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class EventCursorPagination(CursorPagination):
    """
    Cursor-based pagination for high-volume time-series data
    (raw events, audit logs, ticket activities).
    Avoids OFFSET penalty on large tables.
    """

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500
    ordering = "-received_at"


class TicketCursorPagination(CursorPagination):
    """Cursor pagination for ticket list (ordered by updated_at DESC)."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
    ordering = "-updated_at"
