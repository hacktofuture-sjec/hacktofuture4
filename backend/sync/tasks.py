"""
Sync Celery tasks.

cleanup_expired_idempotency_keys — daily beat task
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="processing",
    max_retries=1,
    name="sync.tasks.cleanup_expired_idempotency_keys",
)
def cleanup_expired_idempotency_keys(self):
    """Beat task (daily): deletes expired idempotency key records."""
    from django.utils import timezone

    from .models import IdempotencyKey

    deleted_count, _ = IdempotencyKey.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()

    logger.info(
        "cleanup_expired_idempotency_keys: deleted %s expired keys", deleted_count
    )
    return deleted_count
