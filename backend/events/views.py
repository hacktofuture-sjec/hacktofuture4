"""
Events views:
  POST /api/v1/events/ingest    — FastAPI → Django ingest (ApiKey auth)
  POST /api/v1/dlq              — FastAPI → Django DLQ (ApiKey auth)
  GET  /api/v1/events/          — list raw events (JWT, org-scoped)
  GET  /api/v1/events/{id}/     — single event detail
  GET  /api/v1/dlq/             — list DLQ entries
  POST /api/v1/dlq/{id}/retry/  — manually retry a DLQ entry
"""

import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import EventCursorPagination
from core.permissions import HasApiKey

from .filters import RawWebhookEventFilter
from .models import DeadLetterQueue, RawWebhookEvent
from .serializers import (
    DLQIngestSerializer,
    DeadLetterQueueSerializer,
    EventIngestSerializer,
    RawWebhookEventSerializer,
)
from .tasks import process_raw_webhook

logger = logging.getLogger(__name__)


class EventIngestView(APIView):
    """
    POST /api/v1/events/ingest
    Called by FastAPI agent service to store raw webhook and trigger pipeline.
    Authenticated by X-API-Key header.
    """

    authentication_classes = []
    permission_classes = [HasApiKey]

    @transaction.atomic
    def post(self, request):
        serializer = EventIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            event = RawWebhookEvent.objects.create(
                organization_id=data["organization_id"],
                integration_id=data["integration_id"],
                integration_account_id=data.get("integration_account_id"),
                event_type=data["event_type"],
                payload=data["payload"],
                idempotency_key=data["idempotency_key"],
            )
        except IntegrityError:
            # Duplicate idempotency key — return existing event
            existing = RawWebhookEvent.objects.get(
                idempotency_key=data["idempotency_key"]
            )
            logger.info(
                "Duplicate ingest rejected, key=%s", data["idempotency_key"]
            )
            return Response(
                {
                    "event_id": existing.id,
                    "status": existing.status,
                    "duplicate": True,
                },
                status=status.HTTP_200_OK,
            )

        # Fire async Celery task on ingestion queue
        process_raw_webhook.apply_async(
            args=[event.id], queue="ingestion", countdown=0
        )

        logger.info(
            "Event ingested: id=%s type=%s integration=%s",
            event.id,
            event.event_type,
            event.integration_id,
        )
        return Response(
            {"event_id": event.id, "status": event.status, "duplicate": False},
            status=status.HTTP_201_CREATED,
        )


class DLQIngestView(APIView):
    """
    POST /api/v1/dlq
    Called by FastAPI agent service when a pipeline exhausts retries.
    """

    authentication_classes = []
    permission_classes = [HasApiKey]

    @transaction.atomic
    def post(self, request):
        serializer = DLQIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            event = RawWebhookEvent.objects.get(pk=data["event_id"])
        except RawWebhookEvent.DoesNotExist:
            return Response(
                {"error": "not_found", "detail": "Raw event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        event.status = "failed"
        event.save(update_fields=["status"])

        dlq, created = DeadLetterQueue.objects.update_or_create(
            raw_event=event,
            defaults={
                "organization": event.organization,
                "failure_reason": data["failure_reason"],
                "error_trace": data["error_trace"],
                "retry_count": data["retry_count"],
                "last_retry_at": timezone.now(),
                "status": "exhausted",
            },
        )

        return Response(
            {"dlq_id": dlq.id, "created": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RawWebhookEventListView(generics.ListAPIView):
    """GET /api/v1/events/ — paginated, org-scoped, filterable."""

    serializer_class = RawWebhookEventSerializer
    pagination_class = EventCursorPagination
    filterset_class = RawWebhookEventFilter

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            RawWebhookEvent.objects.filter(organization=org)
            .select_related("integration", "integration_account")
            .order_by("-received_at")
        )


class RawWebhookEventDetailView(generics.RetrieveAPIView):
    """GET /api/v1/events/{id}/"""

    serializer_class = RawWebhookEventSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return RawWebhookEvent.objects.filter(organization=org)


class DLQListView(generics.ListAPIView):
    """GET /api/v1/dlq/ — org-scoped DLQ entries."""

    serializer_class = DeadLetterQueueSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return DeadLetterQueue.objects.filter(organization=org).select_related(
            "raw_event"
        )


class DLQRetryView(APIView):
    """POST /api/v1/dlq/{id}/retry/ — manually re-queue a DLQ entry."""

    @transaction.atomic
    def post(self, request, pk):
        org = request.user.profile.organization
        try:
            dlq = DeadLetterQueue.objects.select_related("raw_event").get(
                pk=pk, organization=org
            )
        except DeadLetterQueue.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        dlq.raw_event.status = "pending"
        dlq.raw_event.save(update_fields=["status"])
        dlq.status = "pending_retry"
        dlq.retry_count += 1
        dlq.last_retry_at = timezone.now()
        dlq.save(update_fields=["status", "retry_count", "last_retry_at"])

        process_raw_webhook.apply_async(
            args=[dlq.raw_event_id], queue="ingestion", countdown=5
        )
        return Response({"detail": "Re-queued for processing."})
