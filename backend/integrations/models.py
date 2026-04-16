"""
Integrations models: Integration, IntegrationAccount.

Generic provider model — NOT hardcoded per provider.
Provider behaviour is driven entirely by the `provider` field value
and the JSONB `config` / `credentials` fields.
"""

from django.contrib.auth import get_user_model
from django.db import models

from core.models import TimestampedModel

User = get_user_model()

PROVIDER_CHOICES = [
    ("jira", "Jira"),
    ("slack", "Slack"),
    ("linear", "Linear"),
    ("hubspot", "HubSpot"),
    ("github", "GitHub"),
]


class Integration(TimestampedModel):
    """
    Represents a configured connection to an external provider.
    One org can have multiple integrations to the same provider
    (e.g. two Jira instances), differentiated by `name`.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="integrations",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_integrations",
    )
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    name = models.CharField(
        max_length=255,
        help_text="User-visible label, e.g. 'Acme Jira Prod'",
    )
    config = models.JSONField(
        default=dict,
        help_text="JSONB: base_url, workspace_id, project_keys, etc.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Integration"
        verbose_name_plural = "Integrations"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "provider", "name"],
                name="unique_org_integration_name",
            )
        ]
        indexes = [
            models.Index(
                fields=["organization", "provider"],
                name="integration_org_provider_idx",
            ),
            models.Index(
                fields=["organization", "is_active"],
                name="integration_org_active_idx",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.provider}) @ {self.organization_id}"


class IntegrationAccount(TimestampedModel):
    """
    A specific account/workspace within an integration (e.g. a Jira project,
    HubSpot portal, or Slack workspace).

    organization_id is REQUIRED per AGENTS.md for multi-tenancy.
    credentials are stored as JSONB (must be encrypted at rest in prod).
    """

    integration = models.ForeignKey(
        Integration,
        on_delete=models.CASCADE,
        related_name="accounts",
    )
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="integration_accounts",
    )
    external_account_id = models.CharField(
        max_length=255,
        help_text="Provider's account/workspace identifier",
    )
    display_name = models.CharField(max_length=255, blank=True)
    credentials = models.JSONField(
        default=dict,
        help_text="JSONB: OAuth tokens, API keys (encrypt in prod). Write-only on API.",
    )
    scopes = models.JSONField(
        default=list,
        help_text="JSONB list of OAuth scopes granted",
    )
    token_expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Integration Account"
        verbose_name_plural = "Integration Accounts"
        constraints = [
            models.UniqueConstraint(
                fields=["integration", "external_account_id"],
                name="unique_integration_account",
            )
        ]
        indexes = [
            models.Index(
                fields=["organization", "integration"],
                name="intaccount_org_integration_idx",
            ),
            models.Index(
                fields=["integration", "is_active"],
                name="intaccount_int_active_idx",
            ),
        ]

    def __str__(self):
        return f"{self.display_name or self.external_account_id} ({self.integration.provider})"
