"""
Core domain models: UnifiedTicket and related entities.

UnifiedTicket     — normalized cross-provider ticket (Jira/Linear/GitHub/HubSpot)
TicketActivity    — audit trail of field changes
TicketComment     — unified comment model
TicketLink        — inter-ticket relationships (blocks, duplicates, relates)
ExternalIdentity  — maps provider user IDs to internal Django users

Index strategy (per AGENTS.md STRICT requirements):
  GIN  : provider_metadata (JSONB)
  Partial : normalized_status IN ('open','in_progress','blocked')
  Composite: (integration_id, external_ticket_id)
             (assignee_id, normalized_status)
             (normalized_status, normalized_type)
  Covering : normalized_status INCLUDE (id, title)   — Postgres 14
  Time     : updated_at DESC
"""

from django.contrib.auth import get_user_model
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.db.models import Q

from core.models import TimestampedModel

User = get_user_model()

NORMALIZED_STATUS_CHOICES = [
    ("open", "Open"),
    ("in_progress", "In Progress"),
    ("blocked", "Blocked"),
    ("resolved", "Resolved"),
]

NORMALIZED_TYPE_CHOICES = [
    ("bug", "Bug"),
    ("feature", "Feature"),
    ("task", "Task"),
    ("epic", "Epic"),
    ("story", "Story"),
    ("subtask", "Subtask"),
    ("other", "Other"),
]

PRIORITY_CHOICES = [
    ("critical", "Critical"),
    ("high", "High"),
    ("medium", "Medium"),
    ("low", "Low"),
    ("none", "None"),
]


class ExternalIdentity(TimestampedModel):
    """
    Maps an external provider user ID to an internal Django User.
    One external identity per (integration, external_user_id).
    Used for ticket assignee / reporter / activity actor resolution.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="external_identities",
    )
    integration = models.ForeignKey(
        "integrations.Integration",
        on_delete=models.CASCADE,
        related_name="external_identities",
    )
    external_user_id = models.CharField(
        max_length=255,
        help_text="User's ID in the source provider system",
    )
    display_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    avatar_url = models.URLField(blank=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="external_identities",
        help_text="Linked internal Django user (if resolved)",
    )
    provider_metadata = models.JSONField(default=dict)

    class Meta:
        verbose_name = "External Identity"
        verbose_name_plural = "External Identities"
        constraints = [
            models.UniqueConstraint(
                fields=["integration", "external_user_id"],
                name="unique_external_identity",
            )
        ]
        indexes = [
            models.Index(
                fields=["organization", "integration"],
                name="extidentity_org_int_idx",
            ),
            models.Index(fields=["email"], name="extidentity_email_idx"),
        ]

    def __str__(self):
        name = self.display_name or self.external_user_id
        return f"{name} ({self.integration.provider})"


class UnifiedTicket(TimestampedModel):
    """
    The central normalized ticket — the output of the LangGraph pipeline.

    Upsert key: (integration, external_ticket_id)
    All indexes match AGENTS.md spec exactly.
    """

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    integration = models.ForeignKey(
        "integrations.Integration",
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    integration_account = models.ForeignKey(
        "integrations.IntegrationAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    processing_run = models.ForeignKey(
        "processing.ProcessingRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    external_ticket_id = models.CharField(
        max_length=255,
        help_text="Ticket ID in the source provider (e.g. PROJ-123)",
    )
    title = models.CharField(max_length=1000)
    description = models.TextField(blank=True)
    normalized_status = models.CharField(
        max_length=20, choices=NORMALIZED_STATUS_CHOICES
    )
    normalized_type = models.CharField(
        max_length=20, choices=NORMALIZED_TYPE_CHOICES, default="task"
    )
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="none")
    assignee = models.ForeignKey(
        ExternalIdentity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
    )
    reporter = models.ForeignKey(
        ExternalIdentity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reported_tickets",
    )
    due_date = models.DateField(null=True, blank=True, help_text="ISO-8601 date")
    provider_metadata = models.JSONField(
        default=dict,
        help_text="JSONB: provider-specific raw fields (sprint, story points, etc.)",
    )
    labels = models.JSONField(default=list, help_text="JSONB list of label strings")
    source_created_at = models.DateTimeField(
        null=True, blank=True, help_text="When created in source system"
    )
    source_updated_at = models.DateTimeField(
        null=True, blank=True, help_text="When last updated in source system"
    )

    class Meta:
        verbose_name = "Unified Ticket"
        verbose_name_plural = "Unified Tickets"
        constraints = [
            models.UniqueConstraint(
                fields=["integration", "external_ticket_id"],
                name="unique_ticket_per_integration",
            )
        ]
        indexes = [
            # GIN index on JSONB provider_metadata
            GinIndex(
                fields=["provider_metadata"],
                name="ticket_prov_meta_gin_idx",
            ),
            # Partial index — active tickets only (Postgres 14)
            models.Index(
                fields=["normalized_status"],
                name="ticket_active_status_idx",
                condition=Q(normalized_status__in=["open", "in_progress", "blocked"]),
            ),
            # Composite: upsert lookup key
            models.Index(
                fields=["integration", "external_ticket_id"],
                name="ticket_int_ext_id_idx",
            ),
            # Composite: assignee workload queries
            models.Index(
                fields=["assignee", "normalized_status"],
                name="ticket_assignee_status_idx",
            ),
            # Composite: status + type filtering
            models.Index(
                fields=["normalized_status", "normalized_type"],
                name="ticket_status_type_idx",
            ),
            # Covering index: Postgres 14 INCLUDE — avoids heap fetch for list views
            models.Index(
                fields=["normalized_status"],
                name="ticket_status_covering_idx",
                include=["id", "title"],
            ),
            # Time-based
            models.Index(fields=["-updated_at"], name="ticket_updated_at_idx"),
            # Org + status for dashboard counts
            models.Index(
                fields=["organization", "normalized_status"],
                name="ticket_org_status_idx",
            ),
        ]

    def __str__(self):
        return f"[{self.external_ticket_id}] {self.title[:60]}"


class TicketActivity(models.Model):
    """
    Append-only audit trail of all field changes on a ticket.
    Sourced from the provider's changelog/activity stream.
    """

    ACTIVITY_TYPE_CHOICES = [
        ("status_change", "Status Change"),
        ("assignment", "Assignment"),
        ("comment", "Comment"),
        ("label", "Label"),
        ("priority", "Priority"),
        ("custom", "Custom"),
    ]

    ticket = models.ForeignKey(
        UnifiedTicket,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    actor = models.ForeignKey(
        ExternalIdentity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_activities",
    )
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    changes = models.JSONField(
        default=dict,
        help_text="JSONB: {field_name: {from: '...', to: '...'}}",
    )
    occurred_at = models.DateTimeField(
        help_text="When this activity happened in the source system"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ticket Activity"
        verbose_name_plural = "Ticket Activities"
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(
                fields=["ticket", "-occurred_at"],
                name="activity_ticket_time_idx",
            )
        ]

    def __str__(self):
        return f"Activity[{self.activity_type}] on ticket {self.ticket_id}"


class TicketComment(TimestampedModel):
    """Provider-sourced comment unified across all ticket systems."""

    ticket = models.ForeignKey(
        UnifiedTicket,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="ticket_comments",
    )
    external_comment_id = models.CharField(max_length=255, blank=True)
    author = models.ForeignKey(
        ExternalIdentity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comments",
    )
    body = models.TextField()
    body_html = models.TextField(blank=True, help_text="Rendered HTML if available")
    is_internal = models.BooleanField(
        default=False, help_text="Internal note vs. public comment"
    )
    source_created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Ticket Comment"
        verbose_name_plural = "Ticket Comments"
        constraints = [
            models.UniqueConstraint(
                fields=["ticket", "external_comment_id"],
                condition=~Q(external_comment_id=""),
                name="unique_external_comment",
            )
        ]
        indexes = [
            models.Index(
                fields=["ticket", "-source_created_at"],
                name="comment_ticket_time_idx",
            )
        ]

    def __str__(self):
        return f"Comment[{self.external_comment_id}] on ticket {self.ticket_id}"


class TicketLink(models.Model):
    """
    Directed relationship between two unified tickets.
    e.g. PROJ-1 blocks PROJ-2.
    """

    LINK_TYPE_CHOICES = [
        ("blocks", "Blocks"),
        ("is_blocked_by", "Is Blocked By"),
        ("duplicates", "Duplicates"),
        ("is_duplicate_of", "Is Duplicate Of"),
        ("relates_to", "Relates To"),
        ("clones", "Clones"),
    ]

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="ticket_links",
    )
    source_ticket = models.ForeignKey(
        UnifiedTicket,
        on_delete=models.CASCADE,
        related_name="outgoing_links",
    )
    target_ticket = models.ForeignKey(
        UnifiedTicket,
        on_delete=models.CASCADE,
        related_name="incoming_links",
    )
    link_type = models.CharField(max_length=30, choices=LINK_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ticket Link"
        verbose_name_plural = "Ticket Links"
        constraints = [
            models.UniqueConstraint(
                fields=["source_ticket", "target_ticket", "link_type"],
                name="unique_ticket_link",
            )
        ]

    def __str__(self):
        return f"{self.source_ticket_id} →[{self.link_type}]→ {self.target_ticket_id}"
