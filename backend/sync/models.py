"""
Sync and idempotency models.

SyncCheckpoint — stores per-integration sync cursor/page token for incremental sync
IdempotencyKey — caches request results to prevent duplicate processing
"""

from django.db import models

from core.models import TimestampedModel


class SyncCheckpoint(TimestampedModel):
    """
    Tracks where a sync left off for each integration account.
    Used to implement incremental sync (delta, not full re-fetch).
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="sync_checkpoints",
    )
    integration_account = models.ForeignKey(
        "integrations.IntegrationAccount",
        on_delete=models.CASCADE,
        related_name="sync_checkpoints",
    )
    checkpoint_key = models.CharField(
        max_length=255,
        help_text="Identifies what is being synced, e.g. 'jira_issues_cursor'",
    )
    checkpoint_value = models.JSONField(
        default=dict,
        help_text="JSONB: {cursor, page_token, since_date, page_number, etc.}",
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    records_synced = models.IntegerField(
        default=0, help_text="Record count from last sync run"
    )

    class Meta:
        verbose_name = "Sync Checkpoint"
        verbose_name_plural = "Sync Checkpoints"
        constraints = [
            models.UniqueConstraint(
                fields=["integration_account", "checkpoint_key"],
                name="unique_sync_checkpoint",
            )
        ]
        indexes = [
            models.Index(
                fields=["organization", "integration_account"],
                name="checkpoint_org_account_idx",
            )
        ]

    def __str__(self):
        return f"Checkpoint[{self.checkpoint_key}] @ account={self.integration_account_id}"


class IdempotencyKey(models.Model):
    """
    Prevents duplicate processing of identical requests.

    Key is SHA-256 of (org_id + request_path + request_body_hash).
    Result is cached for the TTL so repeated requests return the same response.
    """

    key = models.CharField(max_length=255, unique=True)
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="idempotency_keys",
    )
    result = models.JSONField(
        null=True, blank=True, help_text="JSONB: cached HTTP response body"
    )
    request_path = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="Records auto-cleaned after this timestamp"
    )

    class Meta:
        verbose_name = "Idempotency Key"
        verbose_name_plural = "Idempotency Keys"
        indexes = [
            models.Index(fields=["expires_at"], name="idempkey_expires_idx"),
            models.Index(
                fields=["organization", "key"], name="idempkey_org_key_idx"
            ),
        ]

    def __str__(self):
        return f"IdempKey[{self.key[:16]}…] expires={self.expires_at}"
