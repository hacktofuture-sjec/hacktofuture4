"""
Events app tests.
"""

import hashlib
import json
import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestRawWebhookEventModel:
    def test_event_stored_with_jsonb_payload(
        self, org_fixture, integration_fixture, db
    ):
        from events.models import RawWebhookEvent

        payload = {"issue": {"id": "PROJ-1", "summary": "Test Bug"}}
        key = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode()
        ).hexdigest()

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload=payload,
            idempotency_key=key,
        )
        assert event.status == "pending"
        assert event.payload["issue"]["id"] == "PROJ-1"

    def test_duplicate_idempotency_key_raises_integrity_error(
        self, org_fixture, integration_fixture, db
    ):
        from events.models import RawWebhookEvent

        key = "unique-test-key-001"
        RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key=key,
        )
        with pytest.raises(IntegrityError):
            RawWebhookEvent.objects.create(
                organization=org_fixture,
                integration=integration_fixture,
                event_type="jira.issue.updated",
                payload={},
                idempotency_key=key,
            )


@pytest.mark.django_db
class TestIngestEndpoint:
    def test_ingest_without_api_key_returns_403(self, client, org_fixture, integration_fixture):
        resp = client.post(
            "/api/v1/events/ingest",
            {
                "organization_id": str(org_fixture.id),
                "integration_id": integration_fixture.id,
                "event_type": "jira.issue.created",
                "payload": {"test": True},
            },
            content_type="application/json",
        )
        assert resp.status_code in [403, 401]

    def test_event_list_requires_auth(self, client):
        resp = client.get("/api/v1/events/")
        assert resp.status_code == 401
