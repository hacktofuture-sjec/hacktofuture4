"""
Tickets views.

POST /api/v1/tickets/upsert    — idempotent upsert from FastAPI (ApiKey auth)
GET  /api/v1/tickets/          — list with filters (JWT auth, org-scoped)
GET  /api/v1/tickets/{id}/     — detail
GET  /api/v1/tickets/{id}/activities/
GET  /api/v1/tickets/{id}/comments/
GET  /api/v1/identities/map    — identity resolution for FastAPI (ApiKey auth)
"""

import logging

from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import TicketCursorPagination
from core.permissions import HasApiKey

from .filters import UnifiedTicketFilter
from .models import ExternalIdentity, TicketActivity, TicketComment, UnifiedTicket
from .serializers import (
    TicketActivitySerializer,
    TicketCommentSerializer,
    TicketUpsertSerializer,
    UnifiedTicketDetailSerializer,
    UnifiedTicketListSerializer,
)

logger = logging.getLogger(__name__)


class TicketUpsertView(APIView):
    """
    POST /api/v1/tickets/upsert
    Idempotent ticket create/update via (integration_id, external_ticket_id).
    Called exclusively by the FastAPI agent service after pipeline completion.
    """

    authentication_classes = []
    permission_classes = [HasApiKey]

    @transaction.atomic
    def post(self, request):
        serializer = TicketUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Resolve assignee ExternalIdentity if provided
        assignee = None
        if data.get("assignee_external_id"):
            assignee = ExternalIdentity.objects.filter(
                integration_id=data["integration_id"],
                external_user_id=data["assignee_external_id"],
            ).first()

        reporter = None
        if data.get("reporter_external_id"):
            reporter = ExternalIdentity.objects.filter(
                integration_id=data["integration_id"],
                external_user_id=data["reporter_external_id"],
            ).first()

        ticket, created = UnifiedTicket.objects.update_or_create(
            integration_id=data["integration_id"],
            external_ticket_id=data["external_ticket_id"],
            defaults={
                "organization_id": data["organization_id"],
                "integration_account_id": data.get("integration_account_id"),
                "processing_run_id": data.get("processing_run_id"),
                "title": data["title"],
                "description": data["description"],
                "normalized_status": data["normalized_status"],
                "normalized_type": data["normalized_type"],
                "priority": data["priority"],
                "assignee": assignee,
                "reporter": reporter,
                "due_date": data.get("due_date"),
                "provider_metadata": data["provider_metadata"],
                "labels": data["labels"],
                "source_created_at": data.get("source_created_at"),
                "source_updated_at": data.get("source_updated_at"),
            },
        )

        logger.info(
            "Ticket upsert: id=%s external=%s created=%s",
            ticket.id,
            ticket.external_ticket_id,
            created,
        )
        return Response(
            {"ticket_id": ticket.id, "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class TicketListView(generics.ListAPIView):
    """GET /api/v1/tickets/ — org-scoped, filterable, cursor-paginated."""

    serializer_class = UnifiedTicketListSerializer
    pagination_class = TicketCursorPagination
    filterset_class = UnifiedTicketFilter

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            UnifiedTicket.objects.filter(organization=org)
            .select_related("integration", "assignee", "reporter")
            .order_by("-updated_at")
        )


class TicketDetailView(generics.RetrieveAPIView):
    """GET /api/v1/tickets/{id}/"""

    serializer_class = UnifiedTicketDetailSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            UnifiedTicket.objects.filter(organization=org)
            .select_related("integration", "assignee", "reporter")
            .prefetch_related(
                "activities__actor",
                "comments__author",
                "outgoing_links",
            )
        )


class TicketActivityListView(generics.ListAPIView):
    """GET /api/v1/tickets/{ticket_id}/activities/"""

    serializer_class = TicketActivitySerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            TicketActivity.objects.filter(
                ticket_id=self.kwargs["ticket_id"],
                ticket__organization=org,
            )
            .select_related("actor")
            .order_by("-occurred_at")
        )


class TicketCommentListView(generics.ListAPIView):
    """GET /api/v1/tickets/{ticket_id}/comments/"""

    serializer_class = TicketCommentSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            TicketComment.objects.filter(
                ticket_id=self.kwargs["ticket_id"],
                organization=org,
            )
            .select_related("author")
            .order_by("source_created_at")
        )


class IdentityMapView(APIView):
    """
    GET /api/v1/identities/map?integration_id=X&external_user_id=Y
    Called by FastAPI agent to resolve external user → internal Django user.
    """

    authentication_classes = []
    permission_classes = [HasApiKey]

    def get(self, request):
        integration_id = request.query_params.get("integration_id")
        external_user_id = request.query_params.get("external_user_id")

        if not integration_id or not external_user_id:
            return Response(
                {"error": "integration_id and external_user_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identity = (
            ExternalIdentity.objects.filter(
                integration_id=integration_id,
                external_user_id=external_user_id,
            )
            .select_related("user")
            .first()
        )

        if not identity:
            return Response({"found": False, "internal_user_id": None})

        return Response(
            {
                "found": True,
                "internal_user_id": identity.user_id,
                "external_identity_id": identity.id,
                "display_name": identity.display_name,
                "email": identity.email,
            }
        )
