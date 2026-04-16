"""
Events Celery tasks.

process_raw_webhook  — triggered on event ingest, calls FastAPI pipeline
retry_failed_events  — beat task, picks pending DLQ entries
"""

import logging
import traceback

import httpx
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

AGENT_PIPELINE_URL = f"{settings.AGENT_SERVICE_URL}/pipeline/run"


@shared_task(
    bind=True,
    queue="ingestion",
    max_retries=5,
    acks_late=True,
    name="events.tasks.process_raw_webhook",
)
def process_raw_webhook(self, event_id: int):
    """
    Main ingestion task: sends raw event to FastAPI LangGraph pipeline.
    Retries up to 5 times with exponential backoff (60s, 120s, 240s, 480s, 960s).
    Exhausted events are pushed to DeadLetterQueue.
    """
    from events.models import RawWebhookEvent  # noqa: PLC0415

    try:
        with transaction.atomic():
            event = RawWebhookEvent.objects.select_for_update().get(pk=event_id)
            if event.status == "processed":
                logger.info("Event %s already processed, skipping.", event_id)
                return

            event.status = "processing"
            event.save(update_fields=["status"])

        logger.info(
            "Processing event id=%s type=%s attempt=%s",
            event_id,
            event.event_type,
            self.request.retries + 1,
        )

        payload = {
            "event_id": event.id,
            "source": event.integration.provider if event.integration else "unknown",
            "raw_payload": event.payload,
            "organization_id": str(event.organization_id),
            "integration_id": event.integration_id,
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                AGENT_PIPELINE_URL,
                json=payload,
                headers={"X-API-Key": settings.AGENT_SERVICE_API_KEY},
            )
            response.raise_for_status()

        with transaction.atomic():
            RawWebhookEvent.objects.filter(pk=event_id).update(
                status="processed", processed_at=timezone.now()
            )

        logger.info("Event %s processed successfully.", event_id)

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Agent service HTTP error for event %s: %s",
            event_id,
            exc.response.status_code,
        )
        _handle_task_failure(self, event_id, exc)

    except Exception as exc:
        logger.exception("Unexpected error processing event %s", event_id)
        _handle_task_failure(self, event_id, exc)


def _handle_task_failure(task, event_id: int, exc: Exception):
    """Common retry / DLQ logic for process_raw_webhook failures."""
    from events.models import DeadLetterQueue, RawWebhookEvent

    retry_number = task.request.retries
    max_retries = task.max_retries

    if retry_number < max_retries:
        countdown = 60 * (2**retry_number)  # 60, 120, 240, 480, 960
        logger.info(
            "Retrying event %s (attempt %s/%s) in %ss",
            event_id,
            retry_number + 1,
            max_retries,
            countdown,
        )
        raise task.retry(exc=exc, countdown=countdown)
    else:
        # Exhausted — push to DLQ
        logger.error(
            "Event %s exhausted retries (%s). Moving to DLQ.", event_id, max_retries
        )
        with transaction.atomic():
            try:
                event = RawWebhookEvent.objects.get(pk=event_id)
                event.status = "failed"
                event.save(update_fields=["status"])

                DeadLetterQueue.objects.update_or_create(
                    raw_event=event,
                    defaults={
                        "organization": event.organization,
                        "failure_reason": str(exc),
                        "error_trace": {
                            "type": type(exc).__name__,
                            "message": str(exc),
                            "traceback": traceback.format_exc(),
                        },
                        "retry_count": max_retries,
                        "last_retry_at": timezone.now(),
                        "status": "exhausted",
                    },
                )
            except Exception as dlq_exc:
                logger.exception(
                    "Failed to write event %s to DLQ: %s", event_id, dlq_exc
                )


@shared_task(
    bind=True,
    queue="ingestion",
    max_retries=1,
    name="events.tasks.retry_failed_events",
)
def retry_failed_events(self):
    """
    Beat task (every 5 minutes): re-queues pending DLQ entries with retry_count < 3.
    """
    from events.models import DeadLetterQueue

    dlq_entries = DeadLetterQueue.objects.filter(
        status="pending_retry", retry_count__lt=3
    ).select_related("raw_event")[:50]

    queued = 0
    for dlq in dlq_entries:
        dlq.raw_event.status = "pending"
        dlq.raw_event.save(update_fields=["status"])
        process_raw_webhook.apply_async(
            args=[dlq.raw_event_id], queue="ingestion", countdown=10
        )
        dlq.last_retry_at = timezone.now()
        dlq.save(update_fields=["last_retry_at"])
        queued += 1

    logger.info("retry_failed_events: re-queued %s events", queued)
    return queued
