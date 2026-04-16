"""
Tickets model tests.
"""

import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestUnifiedTicket:
    def test_upsert_idempotency_unique_constraint(
        self, org_fixture, integration_fixture, db
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

        # Second create with same (integration, external_ticket_id) must fail
        with pytest.raises(IntegrityError):
            UnifiedTicket.objects.create(
                organization=org_fixture,
                integration=integration_fixture,
                external_ticket_id="PROJ-1",
                title="Duplicate",
                normalized_status="open",
                normalized_type="task",
            )

    def test_update_or_create_is_idempotent(
        self, org_fixture, integration_fixture, db
    ):
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


@pytest.mark.django_db
class TestTicketAPI:
    def test_ticket_list_requires_auth(self, client):
        resp = client.get("/api/v1/tickets/")
        assert resp.status_code == 401

    def test_ticket_upsert_requires_api_key(self, client, org_fixture, integration_fixture):
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
