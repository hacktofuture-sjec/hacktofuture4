"""Insights, Dashboard, SavedQuery serializers + views + URLs."""

from rest_framework import generics, serializers

from .models import Dashboard, DashboardWidget, Insight, InsightSource, SavedQuery

# ── serializers ──────────────────────────────────────────────────────────────


class InsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insight
        fields = [
            "id",
            "insight_type",
            "title",
            "content",
            "period_start",
            "period_end",
            "generated_by",
            "confidence_score",
            "is_pinned",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DashboardWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardWidget
        fields = ["id", "widget_type", "title", "config", "position"]


class DashboardSerializer(serializers.ModelSerializer):
    widgets = DashboardWidgetSerializer(many=True, read_only=True)

    class Meta:
        model = Dashboard
        fields = [
            "id",
            "name",
            "slug",
            "layout",
            "is_default",
            "is_shared",
            "created_at",
            "widgets",
        ]
        read_only_fields = ["id", "created_at"]


class SavedQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedQuery
        fields = [
            "id",
            "name",
            "natural_language_query",
            "resolved_filters",
            "result_cache",
            "cache_expires_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
