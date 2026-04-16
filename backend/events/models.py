"""
Event sourcing models: RawWebhookEvent, DeadLetterQueue.

All raw payloads are stored immutably in JSONB.
Status transitions: pending → processing → processed | failed
Failed events are mirrored to DeadLetterQueue for retry/investigation.

Index strategy (per AGENTS.md):
  - GIN index on payload (JSONB full-text lookup)
  - Partial index on status IN ('pending','failed') — Postgres 14
  - Time-based index on received_at DESC
  - Composite indexes for common query patterns
"""

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from core.models import TimestampedModel


class RawWebhookEvent(TimestampedModel):
    """
    Immutable raw event store — the foundation of event sourcing.

    Every webhook payload from every provider is stored here verbatim BEFORE
    any processing. This ensures full replay capability.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("processed", "Processed"),
        ("failed", "Failed"),
    ]

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="raw_events",
    )
    integration = models.ForeignKey(
        "integrations.Integration",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="raw_events",
    )
    integration_account = models.ForeignKey(
        "integrations.IntegrationAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="raw_events",
    )
    # Forward reference — set after ProcessingRun is created
    processing_run = models.ForeignKey(
        "processing.ProcessingRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_events",
    )
    event_type = models.CharField(
        max_length=100,
        help_text="Provider.resource.action e.g. jira.issue.created",
    )
    payload = models.JSONField(
        help_text="JSONB: raw webhook body — immutable after creation",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    idempotency_key = models.CharField(
        max_length=255,
        unique=True,
        help_text="SHA-256(integration_id + event_type + payload_hash)",
    )
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Raw Webhook Event"
        verbose_name_plural = "Raw Webhook Events"
        indexes = [
            # GIN index for JSONB payload lookups
            GinIndex(fields=["payload"], name="raw_event_payload_gin_idx"),
            # Partial index — only pending/failed events need active querying
            models.Index(
                fields=["status"],
                name="raw_event_pending_failed_idx",
                condition=models.Q(status__in=["pending", "failed"]),
            ),
            # Time-based — newest first
            models.Index(fields=["-received_at"], name="raw_event_received_at_idx"),
            # Composite — org + status for dashboard queries
            models.Index(
                fields=["organization", "status"],
                name="raw_event_org_status_idx",
            ),
            # Composite — integration time-series
            models.Index(
                fields=["integration", "-received_at"],
                name="raw_event_integration_time_idx",
            ),
        ]

    def __str__(self):
        return f"RawEvent[{self.event_type}] {self.status} @ {self.received_at}"


class DeadLetterQueue(TimestampedModel):
    """
    Stores events that exhausted all retry attempts.

    Mirrors a failed RawWebhookEvent with full error context for
    investigation and manual re-processing.
    """

    STATUS_CHOICES = [
        ("pending_retry", "Pending Retry"),
        ("exhausted", "Exhausted"),
        ("resolved", "Resolved"),
    ]

    raw_event = models.OneToOneField(
        RawWebhookEvent,
        on_delete=models.CASCADE,
        related_name="dead_letter",
    )
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="dead_letter_queue",
    )
    failure_reason = models.TextField()
    error_trace = models.JSONField(
        default=dict,
        help_text="JSONB: full exception info {type, message, traceback, context}",
    )
    retry_count = models.IntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending_retry"
    )

    class Meta:
        verbose_name = "Dead Letter Queue Entry"
        verbose_name_plural = "Dead Letter Queue"
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="dlq_org_status_idx",
            ),
            models.Index(fields=["last_retry_at"], name="dlq_retry_at_idx"),
        ]

    def __str__(self):
        return f"DLQ[{self.raw_event_id}] retries={self.retry_count} status={self.status}"
