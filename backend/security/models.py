"""
Security models: ApiKey, AuditLog.

ApiKey   — hashed keys for service-to-service auth (FastAPI → Django).
AuditLog — append-only immutable log of all platform mutations.
"""

import uuid

from django.contrib.auth import get_user_model
from django.db import models

from core.models import TimestampedModel

User = get_user_model()


class ApiKey(TimestampedModel):
    """
    Service API keys for internal service-to-service authentication.

    The raw key is NEVER stored — only a SHA-256 hash.
    The prefix (first 8 chars) is stored for display purposes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="api_keys",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_api_keys",
    )
    name = models.CharField(max_length=255, help_text="Human-readable label for this key")
    hashed_key = models.CharField(max_length=255, unique=True)
    prefix = models.CharField(max_length=10, help_text="First 8 chars of raw key for display")
    permissions = models.JSONField(
        default=list,
        help_text="JSONB list of allowed scopes, e.g. ['events.ingest', 'tickets.upsert']",
    )
    rate_limit_per_minute = models.IntegerField(default=60)
    is_active = models.BooleanField(default=True, db_index=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "API Key"
        verbose_name_plural = "API Keys"
        indexes = [
            models.Index(fields=["organization", "is_active"], name="apikey_org_active_idx"),
            models.Index(fields=["hashed_key"], name="apikey_hash_idx"),
            models.Index(fields=["expires_at"], name="apikey_expiry_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.prefix}...)"


class AuditLog(models.Model):
    """
    Immutable append-only audit trail of every platform action.

    NEVER update or delete rows in this table.
    All writes are INSERT-only.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
    )
    api_key = models.ForeignKey(
        ApiKey,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(
        max_length=100,
        help_text="Dot-notation action, e.g. 'ticket.upsert', 'integration.create'",
    )
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(
        null=True,
        blank=True,
        help_text="JSONB: {before: {...}, after: {...}}",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["organization", "created_at"],
                name="auditlog_org_created_idx",
            ),
            models.Index(
                fields=["resource_type", "resource_id"],
                name="auditlog_resource_idx",
            ),
            models.Index(fields=["actor"], name="auditlog_actor_idx"),
        ]

    def save(self, *args, **kwargs):
        """Enforce append-only: prevent updates to existing records."""
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise PermissionError("AuditLog records are immutable.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.action} by {self.actor_id}"
