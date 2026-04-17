"""
Insights + Dashboard model tests.
"""

import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestInsightModel:
    def test_insight_created_with_jsonb_content(self, org_fixture):
        from insights.models import Insight

        insight = Insight.objects.create(
            organization=org_fixture,
            insight_type="trend",
            title="Ticket volume up 20%",
            content={"metric": "ticket_count", "change": "+20%", "period": "7d"},
            generated_by="gpt-4o",
        )
        assert insight.content["metric"] == "ticket_count"
        assert insight.is_pinned is False

    def test_insight_confidence_score_nullable(self, org_fixture):
        from insights.models import Insight

        insight = Insight.objects.create(
            organization=org_fixture,
            insight_type="anomaly",
            title="Unusual spike in bugs",
            content={"spike_factor": 3.2},
            generated_by="gpt-4o",
        )
        assert insight.confidence_score is None

    def test_insight_str_representation(self, org_fixture):
        from insights.models import Insight

        insight = Insight.objects.create(
            organization=org_fixture,
            insight_type="summary",
            title="Weekly summary",
            content={},
            generated_by="gpt-4o",
        )
        assert "summary" in str(insight).lower()


@pytest.mark.django_db
class TestDashboardModel:
    def test_dashboard_slug_unique_per_org(self, org_fixture):
        from insights.models import Dashboard

        Dashboard.objects.create(
            organization=org_fixture,
            name="Engineering Dashboard",
            slug="engineering",
        )
        with pytest.raises(IntegrityError):
            Dashboard.objects.create(
                organization=org_fixture,
                name="Dup",
                slug="engineering",
            )

    def test_dashboard_layout_stored_as_jsonb(self, org_fixture):
        from insights.models import Dashboard

        layout = {"cols": 12, "rows": [{"widget_id": "w1", "x": 0, "y": 0}]}
        dash = Dashboard.objects.create(
            organization=org_fixture,
            name="Custom Layout",
            slug="custom-layout",
            layout=layout,
        )
        refreshed = Dashboard.objects.get(pk=dash.pk)
        assert refreshed.layout["cols"] == 12
        assert len(refreshed.layout["rows"]) == 1

    def test_dashboard_widget_linked(self, org_fixture):
        from insights.models import Dashboard, DashboardWidget

        dash = Dashboard.objects.create(
            organization=org_fixture,
            name="Widget Test",
            slug="widget-test",
        )
        widget = DashboardWidget.objects.create(
            dashboard=dash,
            widget_type="ticket_count",
            title="Open Ticket Count",
            config={"filter": "status=open"},
            position={"x": 0, "y": 0, "w": 4, "h": 2},
        )
        assert widget.dashboard == dash
        assert "filter" in widget.config


@pytest.mark.django_db
class TestSavedQueryModel:
    def test_saved_query_resolved_filters_jsonb(self, org_fixture, user_fixture):
        from insights.models import SavedQuery

        query = SavedQuery.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Open bugs in sprint",
            natural_language_query="Show me all open bugs in the current sprint",
            resolved_filters={
                "normalized_status": "open",
                "normalized_type": "bug",
                "labels__contains": "sprint:current",
            },
        )
        refreshed = SavedQuery.objects.get(pk=query.pk)
        assert refreshed.resolved_filters["normalized_status"] == "open"
        assert refreshed.result_cache is None
