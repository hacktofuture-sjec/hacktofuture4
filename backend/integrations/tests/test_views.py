"""
Integrations API view tests — Integration CRUD.
"""

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestIntegrationListView:
    """GET/POST /api/v1/integrations/ — JWT auth, org-scoped."""

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/integrations/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_integration(self, auth_client, org_fixture):
        resp = auth_client.post(
            "/api/v1/integrations/",
            {
                "provider": "github",
                "name": "GitHub Org",
                "config": {"org": "acme-corp"},
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["provider"] == "github"
        assert data["is_active"] is True

    def test_list_returns_org_integrations_only(
        self, auth_client, integration_fixture, db
    ):
        from django.contrib.auth import get_user_model

        from accounts.models import Organization
        from integrations.models import Integration

        other_org = Organization.objects.create(
            name="Other Integration Org", slug="other-int-org", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="intother@example.com",
            email="intother@example.com",
            password="pass",
        )
        Integration.objects.create(
            organization=other_org,
            created_by=other_user,
            provider="linear",
            name="Other Linear",
            config={},
        )

        resp = auth_client.get("/api/v1/integrations/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        names = [i["name"] for i in results]
        assert "Other Linear" not in names

    def test_create_requires_provider_and_name(self, auth_client):
        resp = auth_client.post("/api/v1/integrations/", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestIntegrationDetailView:
    """GET/PATCH/DELETE /api/v1/integrations/{pk}/."""

    def test_retrieve_integration(self, auth_client, integration_fixture):
        resp = auth_client.get(f"/api/v1/integrations/{integration_fixture.id}/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["provider"] == "jira"

    def test_update_integration_config(self, auth_client, integration_fixture):
        resp = auth_client.patch(
            f"/api/v1/integrations/{integration_fixture.id}/",
            {
                "config": {
                    "base_url": "https://updated.atlassian.net",
                    "project": "PROJ",
                }
            },
            format="json",
        )
        assert resp.status_code in (200, 204)

    def test_delete_integration(self, auth_client, org_fixture, user_fixture):
        from integrations.models import Integration

        integration = Integration.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            provider="hubspot",
            name="HubSpot To Delete",
            config={},
        )
        resp = auth_client.delete(f"/api/v1/integrations/{integration.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not Integration.objects.filter(pk=integration.pk).exists()

    def test_cannot_access_other_org_integration(self, auth_client, db):
        from django.contrib.auth import get_user_model

        from accounts.models import Organization
        from integrations.models import Integration

        other_org = Organization.objects.create(
            name="Other Int Detail", slug="other-int-detail", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="intdet@example.com", email="intdet@example.com", password="pass"
        )
        other_int = Integration.objects.create(
            organization=other_org,
            created_by=other_user,
            provider="slack",
            name="Private Slack",
            config={},
        )
        resp = auth_client.get(f"/api/v1/integrations/{other_int.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_deactivate_integration(self, auth_client, integration_fixture):
        """PATCH is_active=False should deactivate the integration."""
        resp = auth_client.patch(
            f"/api/v1/integrations/{integration_fixture.id}/",
            {"is_active": False},
            format="json",
        )
        assert resp.status_code in (200, 204)
        integration_fixture.refresh_from_db()
        assert integration_fixture.is_active is False
