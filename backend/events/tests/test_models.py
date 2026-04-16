"""
Comprehensive events model + API tests.
"""

import hashlib
import json

import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestRawWebhookEventModel:
    def test_event_stored_with_jsonb_payload(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent

        payload = {"issue": {"id": "PROJ-1", "summary": "Test Bug"}}
        key = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload=payload,
            idempotency_key=key,
        )
        assert event.status == "pending"
        assert event.payload["issue"]["id"] == "PROJ-1"
        assert event.pk is not None

    def test_event_received_at_auto_set(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="key-auto-date-test",
        )
        assert event.received_at is not None

    def test_duplicate_idempotency_key_raises_integrity_error(
        self, org_fixture, integration_fixture
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

    def test_event_default_status_is_pending(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="slack.message",
            payload={"text": "hello"},
            idempotency_key="slack-test-key-001",
        )
        assert event.status == "pending"

    def test_event_status_can_be_updated(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="linear.issue.updated",
            payload={},
            idempotency_key="linear-update-key-001",
        )
        event.status = "processed"
        event.save(update_fields=["status"])
        refreshed = RawWebhookEvent.objects.get(pk=event.pk)
        assert refreshed.status == "processed"

    def test_event_payload_filtered_by_org(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent

        from accounts.models import Organization

        other_org = Organization.objects.create(name="Other Org", slug="other-org")
        RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="org-filter-key-001",
        )
        RawWebhookEvent.objects.create(
            organization=other_org,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="org-filter-key-002",
        )
        mine = RawWebhookEvent.objects.filter(organization=org_fixture)
        others = RawWebhookEvent.objects.filter(organization=other_org)
        assert mine.count() == 1
        assert others.count() == 1


@pytest.mark.django_db
class TestDeadLetterQueueModel:
    def test_dlq_created_from_event(self, org_fixture, integration_fixture):
        from events.models import DeadLetterQueue, RawWebhookEvent

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.failed",
            payload={"issue_id": "PROJ-99"},
            idempotency_key="dlq-test-key-001",
        )
        dlq = DeadLetterQueue.objects.create(
            raw_event=event,
            organization=org_fixture,
            failure_reason="LLM timeout after 3 retries",
            error_trace={"type": "TimeoutError", "message": "timeout"},
            retry_count=3,
            status="exhausted",
        )
        assert dlq.retry_count == 3
        assert dlq.status == "exhausted"


@pytest.mark.django_db
class TestIngestEndpoint:
    def test_ingest_without_api_key_returns_403(
        self, client, org_fixture, integration_fixture
    ):
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

    def test_ingest_with_valid_api_key_succeeds(
        self, client, org_fixture, integration_fixture, api_key_fixture
    ):
        resp = client.post(
            "/api/v1/events/ingest",
            {
                "organization_id": str(org_fixture.id),
                "integration_id": integration_fixture.id,
                "event_type": "jira.issue.created",
                "payload": {"issue": {"id": "PROJ-9"}},
            },
            content_type="application/json",
            HTTP_X_API_KEY=api_key_fixture._raw_key,
        )
        assert resp.status_code in [200, 201, 202]

    def test_event_list_requires_auth(self, client):
        resp = client.get("/api/v1/events/")
        assert resp.status_code == 401

    def test_event_list_returns_org_scoped_results(
        self, auth_client, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent

        RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="list-test-key-001",
        )
        resp = auth_client.get("/api/v1/events/")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) >= 1
