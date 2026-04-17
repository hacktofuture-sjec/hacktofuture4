"""
Insights API view tests — Insights, Dashboards, Widgets, SavedQueries.
"""

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestInsightListView:
    """GET /api/v1/insights/ — JWT auth, org-scoped, read-only."""

    def test_requires_auth(self, client):
        resp = client.get("/api/v1/insights/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_org_scoped_insights(
        self, auth_client, org_fixture, user_fixture
    ):
        from insights.models import Insight

        Insight.objects.create(
            organization=org_fixture,
            generated_by="gpt-4o",  # CharField — model name, not FK
            title="Sprint velocity dropped 30%",
            content={"body": "Based on the last 3 sprints..."},  # JSONField
            insight_type="trend",
        )
        resp = auth_client.get("/api/v1/insights/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any("Sprint velocity" in i["title"] for i in results)

    def test_other_org_insights_not_visible(self, auth_client, db):
        from accounts.models import Organization
        from insights.models import Insight

        # from django.contrib.auth import get_user_model

        other_org = Organization.objects.create(
            name="OtherCo", slug="other-co", plan_tier="free"
        )
        # other_user = get_user_model().objects.create_user(
        #     username="other3@example.com", email="other3@example.com", password="pass"
        # )
        Insight.objects.create(
            organization=other_org,
            generated_by="gpt-4o",
            title="Secret insight",
            content={"body": "secret"},
            insight_type="summary",
        )
        resp = auth_client.get("/api/v1/insights/")
        results = resp.json().get("results", resp.json())
        titles = [i["title"] for i in results]
        assert "Secret insight" not in titles


@pytest.mark.django_db
class TestDashboardViews:
    """GET/POST /api/v1/dashboards/ and detail."""

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/dashboards/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_dashboard(self, auth_client, org_fixture):
        resp = auth_client.post(
            "/api/v1/dashboards/",
            {
                "name": "Sprint Overview",
                "slug": "sprint-overview",
                "layout": {"cols": 3},
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["name"] == "Sprint Overview"

    def test_list_dashboards(self, auth_client, org_fixture, user_fixture):
        from insights.models import Dashboard

        Dashboard.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="My Board",
        )
        resp = auth_client.get("/api/v1/dashboards/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any(d["name"] == "My Board" for d in results)

    def test_dashboard_detail_returns_correct_object(
        self, auth_client, org_fixture, user_fixture
    ):
        from insights.models import Dashboard

        dash = Dashboard.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Detail Board",
        )
        resp = auth_client.get(f"/api/v1/dashboards/{dash.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["name"] == "Detail Board"

    def test_cannot_access_other_org_dashboard(self, auth_client, db):
        from django.contrib.auth import get_user_model

        from accounts.models import Organization
        from insights.models import Dashboard

        other_org = Organization.objects.create(
            name="OtherDash", slug="other-dash", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="other4@example.com", email="other4@example.com", password="pass"
        )
        dash = Dashboard.objects.create(
            organization=other_org,
            created_by=other_user,
            name="Private Board",
        )
        resp = auth_client.get(f"/api/v1/dashboards/{dash.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_dashboard(self, auth_client, org_fixture, user_fixture):
        from insights.models import Dashboard

        dash = Dashboard.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="To Be Deleted",
        )
        resp = auth_client.delete(f"/api/v1/dashboards/{dash.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not Dashboard.objects.filter(pk=dash.pk).exists()


@pytest.mark.django_db
class TestDashboardWidgetViews:
    """GET/POST /api/v1/dashboards/{id}/widgets/."""

    def test_list_widgets_for_dashboard(self, auth_client, org_fixture, user_fixture):
        from insights.models import Dashboard, DashboardWidget

        dash = Dashboard.objects.create(
            organization=org_fixture, created_by=user_fixture, name="Widget Board"
        )
        DashboardWidget.objects.create(
            dashboard=dash,
            title="Ticket Status",
            widget_type="status_pie",  # valid choice
            position={"x": 0, "y": 0, "w": 4, "h": 4},
            config={"metric": "status"},
        )
        resp = auth_client.get(f"/api/v1/dashboards/{dash.id}/widgets/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any(w["title"] == "Ticket Status" for w in results)

    def test_create_widget(self, auth_client, org_fixture, user_fixture):
        from insights.models import Dashboard

        dash = Dashboard.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Create Widget Board",
        )
        resp = auth_client.post(
            f"/api/v1/dashboards/{dash.id}/widgets/",
            {
                "title": "Burndown Chart",
                "widget_type": "trend_chart",  # valid choice from WIDGET_TYPE_CHOICES
                "position": {"x": 1, "y": 0, "w": 6, "h": 4},
                "config": {"metric": "closed_vs_opened"},
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.json()
        assert resp.json()["widget_type"] == "trend_chart"


@pytest.mark.django_db
class TestSavedQueryViews:
    """GET/POST /api/v1/saved-queries/ — served by insights app."""

    def test_requires_auth(self, client):
        resp = client.get("/api/v1/saved-queries/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_saved_query(self, auth_client, org_fixture):
        resp = auth_client.post(
            "/api/v1/saved-queries/",
            {
                "name": "Open bugs this sprint",
                "natural_language_query": "show open bugs in current sprint",
                "resolved_filters": {"status": "open", "type": "bug"},
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.json()
        assert resp.json()["name"] == "Open bugs this sprint"

    def test_list_saved_queries_org_scoped(
        self, auth_client, org_fixture, user_fixture
    ):
        from insights.models import SavedQuery

        SavedQuery.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="My Query",
            natural_language_query="show blocked tickets",
            resolved_filters={"status": "blocked"},
        )
        resp = auth_client.get("/api/v1/saved-queries/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any(q["name"] == "My Query" for q in results)
