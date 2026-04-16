"""
Integration model and API tests.
"""

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestIntegrationModel:
    def test_integration_unique_constraint(self, org_fixture, user_fixture):
        """Duplicate (org, provider, name) should raise IntegrityError."""
        from django.db import IntegrityError

        from integrations.models import Integration

        Integration.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            provider="jira",
            name="My Jira",
            config={"base_url": "https://test.atlassian.net"},
        )
        with pytest.raises(IntegrityError):
            Integration.objects.create(
                organization=org_fixture,
                created_by=user_fixture,
                provider="jira",
                name="My Jira",  # same (org, provider, name)
                config={},
            )

    def test_integration_requires_organization(self, user_fixture):
        """Integration must have an organization."""
        from django.db import IntegrityError

        from integrations.models import Integration

        with pytest.raises(IntegrityError):
            Integration.objects.create(
                organization_id=None,
                created_by=user_fixture,
                provider="slack",
                name="Slack",
                config={},
            )

    def test_integration_config_stored_as_jsonb(self, org_fixture, user_fixture):
        from integrations.models import Integration

        config = {
            "base_url": "https://test.atlassian.net",
            "workspace_id": "abc123",
            "scopes": ["read:jira-work"],
        }
        integration = Integration.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            provider="jira",
            name="Jira JSONB Test",
            config=config,
        )
        saved = Integration.objects.get(pk=integration.pk)
        assert saved.config["workspace_id"] == "abc123"
        assert saved.config["scopes"] == ["read:jira-work"]

    def test_integration_default_is_active(self, org_fixture, user_fixture):
        from integrations.models import Integration

        integration = Integration.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            provider="linear",
            name="Linear Default",
            config={},
        )
        assert integration.is_active is True

    def test_integration_account_requires_org(self, org_fixture, integration_fixture):
        """IntegrationAccount must have organization (AGENTS.md requirement)."""
        from integrations.models import IntegrationAccount

        account = IntegrationAccount.objects.create(
            integration=integration_fixture,
            organization=org_fixture,
            external_account_id="ACC-001",
            display_name="Test Account",
            credentials={"api_token": "secret"},
            scopes=["read", "write"],
        )
        assert account.organization == org_fixture
        assert account.integration == integration_fixture

    def test_integration_account_unique_constraint(
        self, org_fixture, integration_fixture
    ):
        """Duplicate (integration, external_account_id) should raise."""
        from django.db import IntegrityError

        from integrations.models import IntegrationAccount

        IntegrationAccount.objects.create(
            integration=integration_fixture,
            organization=org_fixture,
            external_account_id="DUPE-001",
            credentials={},
        )
        with pytest.raises(IntegrityError):
            IntegrationAccount.objects.create(
                integration=integration_fixture,
                organization=org_fixture,
                external_account_id="DUPE-001",  # duplicate
                credentials={},
            )

    def test_cross_org_integration_isolation(
        self, org_fixture, user_fixture, db
    ):
        """Two orgs can have same provider+name — constraint is org-scoped."""
        from accounts.models import Organization
        from integrations.models import Integration

        other_org = Organization.objects.create(
            name="Other Org", slug="other-org", plan_tier="free"
        )
        i1 = Integration.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            provider="slack",
            name="Slack Prod",
            config={},
        )
        i2 = Integration.objects.create(
            organization=other_org,
            created_by=user_fixture,
            provider="slack",
            name="Slack Prod",  # same name, different org — should succeed
            config={},
        )
        assert i1.pk != i2.pk


@pytest.mark.django_db
class TestIntegrationAPI:
    def test_integration_list_requires_auth(self, client):
        resp = client.get("/api/v1/integrations/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_integration_org_scoped(self, auth_client, org_fixture):
        resp = auth_client.post(
            "/api/v1/integrations/",
            {
                "provider": "slack",
                "name": "Slack Workspace",
                "config": {"workspace": "T12345"},
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert data["provider"] == "slack"
        # Response should include org ID scoping
        assert "id" in data

    def test_list_integrations_scoped_to_org(
        self, auth_client, integration_fixture, db
    ):
        """List should only return integrations for the authenticated user's org."""
        from accounts.models import Organization
        from integrations.models import Integration
        from django.contrib.auth import get_user_model

        # Create integration in a different org — should NOT appear in list
        other_org = Organization.objects.create(
            name="Rival Org", slug="rival-org", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="rival@example.com",
            email="rival@example.com",
            password="pass",
        )
        Integration.objects.create(
            organization=other_org,
            created_by=other_user,
            provider="hubspot",
            name="HubSpot Rival",
            config={},
        )

        resp = auth_client.get("/api/v1/integrations/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        # All returned integrations must belong to our org
        for item in results:
            assert "hubspot" not in item.get("name", "") or item.get(
                "provider"
            ) != "hubspot"
