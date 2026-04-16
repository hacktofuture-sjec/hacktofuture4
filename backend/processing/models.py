"""
AI Pipeline storage models.

ProcessingRun        — one LangGraph execution per raw event (attempt)
ProcessingStepLog    — per-node trace log within a run
MappedPayload        — LLM-normalized output (JSONB + GIN)
ValidationResult     — Python validator output linked to mapped payload

These tables are WRITE-ONLY from the Django side (FastAPI writes via API).
"""

import uuid

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from core.models import TimestampedModel


class ProcessingRun(TimestampedModel):
    """Represents one execution of the LangGraph pipeline for a single raw event."""

    STATUS_CHOICES = [
        ("started", "Started"),
        ("mapping", "Mapping"),
        ("validating", "Validating"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="processing_runs",
    )
    # raw_event is set via FK from RawWebhookEvent.processing_run
    # We keep a back-reference here for direct lookup
    raw_event = models.ForeignKey(
        "events.RawWebhookEvent",
        on_delete=models.CASCADE,
        related_name="processing_runs",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="started")
    attempt_count = models.IntegerField(
        default=1,
        help_text="Which LangGraph mapper retry attempt (1–3)",
    )
    llm_model = models.CharField(
        max_length=100,
        blank=True,
        help_text="LLM model used, e.g. gpt-4o",
    )
    source = models.CharField(
        max_length=50,
        help_text="Provider name from TicketState.source",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Processing Run"
        verbose_name_plural = "Processing Runs"
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="procrun_org_status_idx",
            ),
            models.Index(fields=["-started_at"], name="procrun_started_at_idx"),
        ]

    def __str__(self):
        return f"Run[{self.id}] {self.status} attempt={self.attempt_count}"


class ProcessingStepLog(models.Model):
    """
    Per-node execution log within a ProcessingRun.
    Stores full input/output JSONB for observability and debugging.
    """

    STEP_NAMES = [
        ("fetcher", "Fetcher"),
        ("mapper", "Mapper"),
        ("validator", "Validator"),
        ("persist", "Persist"),
        ("dlq", "DLQ"),
    ]

    STATUS_CHOICES = [
        ("started", "Started"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    processing_run = models.ForeignKey(
        ProcessingRun,
        on_delete=models.CASCADE,
        related_name="step_logs",
    )
    step_name = models.CharField(max_length=50, choices=STEP_NAMES)
    sequence = models.IntegerField(help_text="Step order within the run (1, 2, 3…)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    input_data = models.JSONField(
        null=True, blank=True, help_text="JSONB: node input state"
    )
    output_data = models.JSONField(
        null=True, blank=True, help_text="JSONB: node output state"
    )
    error_message = models.TextField(blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Processing Step Log"
        verbose_name_plural = "Processing Step Logs"
        ordering = ["processing_run", "sequence"]
        indexes = [
            models.Index(
                fields=["processing_run", "sequence"],
                name="steplog_run_sequence_idx",
            ),
            models.Index(fields=["-logged_at"], name="steplog_logged_at_idx"),
        ]

    def __str__(self):
        return f"Step[{self.step_name}] seq={self.sequence} {self.status}"


class MappedPayload(models.Model):
    """
    LLM output after the mapper node — the normalized ticket data.
    GIN index on mapped_data for downstream queries.
    """

    processing_run = models.OneToOneField(
        ProcessingRun,
        on_delete=models.CASCADE,
        related_name="mapped_payload",
    )
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="mapped_payloads",
    )
    mapped_data = models.JSONField(
        help_text="JSONB: normalized ticket fields from LLM mapper"
    )
    schema_version = models.CharField(
        max_length=20,
        default="v1",
        help_text="Version of the UnifiedTicket mapping schema",
    )
    mapped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Mapped Payload"
        verbose_name_plural = "Mapped Payloads"
        indexes = [
            # GIN index for JSONB full-field lookups
            GinIndex(fields=["mapped_data"], name="mapped_payload_gin_idx"),
        ]

    def __str__(self):
        return f"MappedPayload[run={self.processing_run_id}] v={self.schema_version}"


class ValidationResult(models.Model):
    """Deterministic Python validator output for a mapped payload."""

    processing_run = models.OneToOneField(
        ProcessingRun,
        on_delete=models.CASCADE,
        related_name="validation_result",
    )
    mapped_payload = models.OneToOneField(
        MappedPayload,
        on_delete=models.CASCADE,
        related_name="validation_result",
    )
    is_valid = models.BooleanField()
    validation_errors = models.JSONField(
        default=list,
        help_text="JSONB list of error strings from validator node",
    )
    validated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Validation Result"
        verbose_name_plural = "Validation Results"

    def __str__(self):
        return f"ValidationResult[{self.processing_run_id}] valid={self.is_valid}"
