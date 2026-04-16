"""
Insights, Dashboards, and SavedQuery models.

Insight       — AI-generated or computed insight (trend, anomaly, summary)
InsightSource — links an insight to the tickets/events it was derived from
Dashboard     — user-configured layout of widgets
DashboardWidget — individual widget within a dashboard
SavedQuery    — stored natural language query + cached results
"""

import uuid

from django.contrib.auth import get_user_model
from django.db import models

from core.models import TimestampedModel

User = get_user_model()


class Insight(TimestampedModel):
    """AI-generated insight about the org's ticket data."""

    INSIGHT_TYPE_CHOICES = [
        ("trend", "Trend"),
        ("anomaly", "Anomaly"),
        ("summary", "Summary"),
        ("prediction", "Prediction"),
        ("recommendation", "Recommendation"),
    ]

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="insights",
    )
    insight_type = models.CharField(max_length=30, choices=INSIGHT_TYPE_CHOICES)
    title = models.CharField(max_length=500)
    content = models.JSONField(
        help_text="JSONB: structured insight content (varies by type)"
    )
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    generated_by = models.CharField(
        max_length=100,
        help_text="Agent or model that produced this insight",
    )
    confidence_score = models.FloatField(
        null=True, blank=True, help_text="0.0–1.0 confidence"
    )
    is_pinned = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Insight"
        verbose_name_plural = "Insights"
        indexes = [
            models.Index(
                fields=["organization", "insight_type"],
                name="insight_org_type_idx",
            ),
            models.Index(
                fields=["organization", "-period_start"],
                name="insight_org_period_idx",
            ),
        ]

    def __str__(self):
        return f"[{self.insight_type}] {self.title[:60]}"


class InsightSource(models.Model):
    """Links an Insight to its source tickets and/or raw events."""

    insight = models.ForeignKey(
        Insight,
        on_delete=models.CASCADE,
        related_name="sources",
    )
    ticket = models.ForeignKey(
        "tickets.UnifiedTicket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="insight_sources",
    )
    raw_event = models.ForeignKey(
        "events.RawWebhookEvent",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="insight_sources",
    )
    relevance_score = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name = "Insight Source"
        verbose_name_plural = "Insight Sources"

    def __str__(self):
        return f"InsightSource[{self.insight_id}]"


class Dashboard(TimestampedModel):
    """A named collection of widgets configured by an org user."""

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="dashboards",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_dashboards",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100)
    layout = models.JSONField(
        default=dict,
        help_text="JSONB: grid layout config for the frontend renderer",
    )
    is_default = models.BooleanField(default=False)
    is_shared = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Dashboard"
        verbose_name_plural = "Dashboards"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_dashboard_slug_per_org",
            )
        ]

    def __str__(self):
        return f"Dashboard: {self.name} ({self.organization_id})"


class DashboardWidget(TimestampedModel):
    """Individual widget within a dashboard (chart, table, counter, etc.)."""

    WIDGET_TYPE_CHOICES = [
        ("ticket_count", "Ticket Count"),
        ("trend_chart", "Trend Chart"),
        ("assignee_breakdown", "Assignee Breakdown"),
        ("status_pie", "Status Pie"),
        ("saved_query_table", "Saved Query Table"),
    ]

    dashboard = models.ForeignKey(
        Dashboard,
        on_delete=models.CASCADE,
        related_name="widgets",
    )
    widget_type = models.CharField(max_length=50, choices=WIDGET_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    config = models.JSONField(
        default=dict,
        help_text="JSONB: widget-specific config (filters, date range, chart type)",
    )
    position = models.JSONField(
        default=dict,
        help_text="JSONB: grid position {x, y, w, h}",
    )

    class Meta:
        verbose_name = "Dashboard Widget"
        verbose_name_plural = "Dashboard Widgets"

    def __str__(self):
        return f"Widget[{self.widget_type}] on dashboard {self.dashboard_id}"


class SavedQuery(TimestampedModel):
    """A stored natural language query with compiled filters and optional result cache."""

    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="saved_queries",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="saved_queries",
    )
    name = models.CharField(max_length=255)
    natural_language_query = models.TextField(
        help_text="The user's question in plain English"
    )
    resolved_filters = models.JSONField(
        default=dict,
        help_text="JSONB: compiled DRF filter parameters",
    )
    result_cache = models.JSONField(
        null=True, blank=True, help_text="JSONB: last query result set"
    )
    cache_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Saved Query"
        verbose_name_plural = "Saved Queries"

    def __str__(self):
        return f"SavedQuery: {self.name}"
