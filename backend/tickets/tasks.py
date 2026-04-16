"""
Tickets Celery tasks.

sync_integration_tickets     — incremental sync for one integration account
sync_all_active_integrations — beat task to trigger all active account syncs
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="ingestion",
    max_retries=3,
    acks_late=True,
    name="tickets.tasks.sync_integration_tickets",
)
def sync_integration_tickets(self, integration_account_id: int):
    """
    Triggers a full incremental sync for a single integration account.
    Reads checkpoint, fetches new events from MCP server via FastAPI,
    then updates the checkpoint on success.
    """
    import httpx
    from django.conf import settings

    from integrations.models import IntegrationAccount
    from sync.models import SyncCheckpoint

    try:
        account = IntegrationAccount.objects.select_related(
            "integration", "organization"
        ).get(pk=integration_account_id, is_active=True)
    except IntegrationAccount.DoesNotExist:
        logger.warning(
            "IntegrationAccount %s not found or inactive.", integration_account_id
        )
        return

    checkpoint, _ = SyncCheckpoint.objects.get_or_create(
        organization=account.organization,
        integration_account=account,
        checkpoint_key=f"{account.integration.provider}_sync_cursor",
        defaults={"checkpoint_value": {}},
    )

    logger.info(
        "Starting sync for account=%s provider=%s",
        integration_account_id,
        account.integration.provider,
    )

    try:
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(
                f"{settings.AGENT_SERVICE_URL}/pipeline/sync",
                json={
                    "integration_account_id": integration_account_id,
                    "provider": account.integration.provider,
                    "config": account.integration.config,
                    "credentials": account.credentials,
                    "checkpoint": checkpoint.checkpoint_value,
                    "organization_id": str(account.organization_id),
                },
                headers={"X-API-Key": settings.AGENT_SERVICE_API_KEY},
            )
            resp.raise_for_status()
            result = resp.json()

        from django.utils import timezone

        checkpoint.checkpoint_value = result.get("next_checkpoint", {})
        checkpoint.last_synced_at = timezone.now()
        checkpoint.records_synced = result.get("records_processed", 0)
        checkpoint.save()

        logger.info(
            "Sync complete: account=%s records=%s",
            integration_account_id,
            checkpoint.records_synced,
        )

    except Exception as exc:
        logger.exception("Sync failed for account=%s", integration_account_id)
        countdown = 60 * (2**self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)


@shared_task(
    bind=True,
    queue="ingestion",
    max_retries=1,
    name="tickets.tasks.sync_all_active_integrations",
)
def sync_all_active_integrations(self):
    """Beat task (15 min): fires sync_integration_tickets per active account."""
    from integrations.models import IntegrationAccount

    accounts = IntegrationAccount.objects.filter(is_active=True).values_list(
        "id", flat=True
    )
    for account_id in accounts:
        sync_integration_tickets.apply_async(
            args=[account_id], queue="ingestion", countdown=0
        )

    logger.info("sync_all_active_integrations: triggered %s accounts", len(accounts))
    return len(accounts)
