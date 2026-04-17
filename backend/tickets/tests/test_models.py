"""
Comprehensive tickets model + API tests.
"""

import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestUnifiedTicketModel:
    def test_upsert_idempotency_unique_constraint(
        self, org_fixture, integration_fixture
    ):
        from tickets.models import UnifiedTicket

        ticket = UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-1",
            title="Test Ticket",
            normalized_status="open",
            normalized_type="bug",
        )
        assert ticket.id is not None

        with pytest.raises(IntegrityError):
            UnifiedTicket.objects.create(
                organization=org_fixture,
                integration=integration_fixture,
                external_ticket_id="PROJ-1",
                title="Duplicate",
                normalized_status="open",
                normalized_type="task",
            )

    def test_update_or_create_is_idempotent(self, org_fixture, integration_fixture):
        from tickets.models import UnifiedTicket

        t1, created1 = UnifiedTicket.objects.update_or_create(
            integration=integration_fixture,
            external_ticket_id="PROJ-2",
            defaults={
                "organization": org_fixture,
                "title": "Original Title",
                "normalized_status": "open",
                "normalized_type": "task",
            },
        )
        assert created1 is True

        t2, created2 = UnifiedTicket.objects.update_or_create(
            integration=integration_fixture,
            external_ticket_id="PROJ-2",
            defaults={
                "organization": org_fixture,
                "title": "Updated Title",
                "normalized_status": "in_progress",
                "normalized_type": "bug",
            },
        )
        assert created2 is False
        assert t2.id == t1.id
        assert t2.title == "Updated Title"
        assert t2.normalized_status == "in_progress"

    def test_provider_metadata_stored_as_jsonb(self, org_fixture, integration_fixture):
        from tickets.models import UnifiedTicket

        metadata = {"sprint": "Sprint 12", "story_points": 5, "epic_link": "EPIC-3"}
        ticket = UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-META-1",
            title="JSONB Test",
            normalized_status="open",
            normalized_type="story",
            provider_metadata=metadata,
        )
        saved = UnifiedTicket.objects.get(pk=ticket.pk)
        assert saved.provider_metadata["sprint"] == "Sprint 12"
        assert saved.provider_metadata["story_points"] == 5

    def test_labels_stored_as_jsonb_list(self, org_fixture, integration_fixture):
        from tickets.models import UnifiedTicket

        labels = ["backend", "priority:high", "team:platform"]
        ticket = UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-LABELS-1",
            title="Labels Test",
            normalized_status="open",
            normalized_type="bug",
            labels=labels,
        )
        saved = UnifiedTicket.objects.get(pk=ticket.pk)
        assert "backend" in saved.labels
        assert len(saved.labels) == 3

    def test_ticket_str_representation(self, org_fixture, integration_fixture):
        from tickets.models import UnifiedTicket

        ticket = UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-STR-1",
            title="String Test Ticket",
            normalized_status="open",
            normalized_type="bug",
        )
        assert "PROJ-STR-1" in str(ticket)

    def test_ticket_indexes_applied_via_meta(self):
        from tickets.models import UnifiedTicket

        index_names = [idx.name for idx in UnifiedTicket._meta.indexes]
        assert "ticket_prov_meta_gin_idx" in index_names
        assert "ticket_int_ext_id_idx" in index_names
        assert "ticket_status_covering_idx" in index_names

    def test_ticket_filter_by_status(self, org_fixture, integration_fixture):
        from tickets.models import UnifiedTicket

        UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-OPEN-1",
            title="Open ticket",
            normalized_status="open",
            normalized_type="bug",
        )
        UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-RESOLVED-1",
            title="Resolved ticket",
            normalized_status="resolved",
            normalized_type="bug",
        )
        open_tickets = UnifiedTicket.objects.filter(
            organization=org_fixture, normalized_status="open"
        )
        assert open_tickets.count() == 1


@pytest.mark.django_db
class TestExternalIdentityModel:
    def test_external_identity_created(self, org_fixture, integration_fixture):
        from tickets.models import ExternalIdentity

        identity = ExternalIdentity.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_user_id="jira-user-001",
            display_name="Alice Smith",
            email="alice@acme.com",
        )
        assert identity.pk is not None

    def test_external_identity_unique_per_integration(
        self, org_fixture, integration_fixture
    ):
        from tickets.models import ExternalIdentity

        ExternalIdentity.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_user_id="jira-user-002",
            display_name="Bob",
        )
        with pytest.raises(IntegrityError):
            ExternalIdentity.objects.create(
                organization=org_fixture,
                integration=integration_fixture,
                external_user_id="jira-user-002",
                display_name="Bob Duplicate",
            )


@pytest.mark.django_db
class TestTicketAPI:
    def test_ticket_list_requires_auth(self, client):
        resp = client.get("/api/v1/tickets/")
        assert resp.status_code == 401

    def test_ticket_upsert_requires_api_key(
        self, client, org_fixture, integration_fixture
    ):
        resp = client.post(
            "/api/v1/tickets/upsert",
            {
                "organization_id": str(org_fixture.id),
                "integration_id": integration_fixture.id,
                "external_ticket_id": "PROJ-3",
                "title": "Test",
                "normalized_status": "open",
            },
            content_type="application/json",
        )
        assert resp.status_code in [401, 403]

    def test_ticket_upsert_with_valid_api_key(
        self, client, org_fixture, integration_fixture, api_key_fixture
    ):
        resp = client.post(
            "/api/v1/tickets/upsert",
            {
                "organization_id": str(org_fixture.id),
                "integration_id": integration_fixture.id,
                "external_ticket_id": "PROJ-API-1",
                "title": "API Created Ticket",
                "description": "Created via API",
                "normalized_status": "open",
                "normalized_type": "bug",
                "priority": "high",
                "provider_metadata": {},
                "labels": [],
            },
            content_type="application/json",
            HTTP_X_API_KEY=api_key_fixture._raw_key,
        )
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "ticket_id" in data
        assert "created" in data

    def test_ticket_list_scoped_to_org(
        self, auth_client, org_fixture, integration_fixture
    ):
        from tickets.models import UnifiedTicket

        UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-LIST-1",
            title="List Test",
            normalized_status="open",
            normalized_type="feature",
        )
        resp = auth_client.get("/api/v1/tickets/")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data

    def test_ticket_filter_by_status_param(
        self, auth_client, org_fixture, integration_fixture
    ):
        from tickets.models import UnifiedTicket

        UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-OPEN-FILTER-1",
            title="Open",
            normalized_status="open",
            normalized_type="bug",
        )
        UnifiedTicket.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            external_ticket_id="PROJ-RESOLVED-FILTER-1",
            title="Resolved",
            normalized_status="resolved",
            normalized_type="bug",
        )
        resp = auth_client.get("/api/v1/tickets/?status=open")
        assert resp.status_code == 200
        for ticket in resp.json().get("results", []):
            assert ticket["normalized_status"] == "open"
