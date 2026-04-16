"""
Events API view tests — covers /api/v1/events/ and /api/v1/dlq/ endpoints.
"""

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestEventIngestView:
    """POST /api/v1/events/ingest — ApiKey auth, triggers Celery task."""

    def test_ingest_requires_api_key(self, client):
        resp = client.post("/api/v1/events/ingest", {}, content_type="application/json")
        assert resp.status_code in (401, 403)

    def test_ingest_rejects_jwt_without_api_key(self, auth_client):
        resp = auth_client.post(
            "/api/v1/events/ingest",
            {"event_type": "test", "payload": {}},
            format="json",
        )
        assert resp.status_code in (401, 403)

    def test_ingest_creates_event(
        self, api_key_fixture, integration_fixture, org_fixture
    ):
        """Valid ApiKey + payload → 202 + event persisted."""
        from unittest.mock import patch

        from rest_framework.test import APIClient

        from events.models import RawWebhookEvent

        client = APIClient()
        client.credentials(HTTP_X_API_KEY=api_key_fixture._raw_key)

        payload = {
            "integration_id": integration_fixture.id,
            "organization_id": str(org_fixture.id),
            "event_type": "jira.issue.created",
            # idempotency_key is auto-generated from hash — do NOT send it
            "payload": {"key": "PROJ-100", "fields": {"summary": "View test"}},
        }
        with patch("events.views.process_raw_webhook.apply_async"):
            resp = client.post("/api/v1/events/ingest", payload, format="json")

        assert resp.status_code in (status.HTTP_201_CREATED, status.HTTP_202_ACCEPTED)
        # Verify the event was stored (filter by event_type + integration)
        assert RawWebhookEvent.objects.filter(
            organization=org_fixture,
            event_type="jira.issue.created",
        ).exists()

    def test_ingest_is_idempotent(
        self, api_key_fixture, integration_fixture, org_fixture
    ):
        """Same idempotency_key twice → 202 both times, only 1 event created."""
        from unittest.mock import patch

        from rest_framework.test import APIClient

        from events.models import RawWebhookEvent

        client = APIClient()
        client.credentials(HTTP_X_API_KEY=api_key_fixture._raw_key)

        # idempotency is keyed on hash(integration_id + event_type + payload)
        # Sending identical payload twice must create only 1 event.
        same_payload = {"key": "PROJ-200"}
        payload = {
            "integration_id": integration_fixture.id,
            "organization_id": str(org_fixture.id),
            "event_type": "jira.issue.idempotent",
            "payload": same_payload,
        }
        with patch("events.views.process_raw_webhook.apply_async"):
            resp1 = client.post("/api/v1/events/ingest", payload, format="json")
            resp2 = client.post("/api/v1/events/ingest", payload, format="json")

        assert resp1.status_code in (status.HTTP_201_CREATED, status.HTTP_202_ACCEPTED)
        assert resp2.status_code in (
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
            status.HTTP_202_ACCEPTED,
        )
        # Exactly 1 event for this payload hash
        count = RawWebhookEvent.objects.filter(
            organization=org_fixture,
            event_type="jira.issue.idempotent",
        ).count()
        assert count == 1

    def test_ingest_missing_event_type_returns_400(
        self, api_key_fixture, org_fixture, integration_fixture
    ):
        from unittest.mock import patch

        from rest_framework.test import APIClient

        client = APIClient()
        client.credentials(HTTP_X_API_KEY=api_key_fixture._raw_key)
        payload = {
            "organization_id": str(org_fixture.id),
            "integration_id": integration_fixture.id,
            # missing event_type
            "payload": {},
        }
        with patch("events.views.process_raw_webhook.apply_async"):
            resp = client.post("/api/v1/events/ingest", payload, format="json")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRawWebhookEventListView:
    """GET /api/v1/events/ — JWT auth, org-scoped."""

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/events/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_returns_org_scoped_events(
        self, auth_client, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent

        RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={"key": "PROJ-1"},
            idempotency_key="list-view-001",
        )
        resp = auth_client.get("/api/v1/events/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any(e["event_type"] == "jira.issue.created" for e in results)

    def test_list_filters_by_status(
        self, auth_client, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent

        RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="slack.message",
            payload={},
            status="processed",
            idempotency_key="filter-status-001",
        )
        resp = auth_client.get("/api/v1/events/?status=processed")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        for event in results:
            assert event["status"] == "processed"

    def test_list_excludes_other_org_events(self, auth_client, org_fixture, db):
        """Events from other orgs must not appear."""
        from django.contrib.auth import get_user_model

        from accounts.models import Organization
        from events.models import RawWebhookEvent
        from integrations.models import Integration

        other_org = Organization.objects.create(
            name="Other", slug="other", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="other2@example.com", email="other2@example.com", password="pass"
        )
        other_int = Integration.objects.create(
            organization=other_org,
            created_by=other_user,
            provider="slack",
            name="Slack",
            config={},
        )
        RawWebhookEvent.objects.create(
            organization=other_org,
            integration=other_int,
            event_type="slack.message",
            payload={"secret": "should-not-leak"},
            idempotency_key="other-org-evt-001",
        )
        resp = auth_client.get("/api/v1/events/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        ikeys = [e.get("idempotency_key") for e in results]
        assert "other-org-evt-001" not in ikeys


@pytest.mark.django_db
class TestDLQViews:
    """DLQ ingest (ApiKey) and DLQ list (JWT)."""

    def test_dlq_ingest_requires_api_key(self, client):
        resp = client.post("/api/v1/dlq", {}, content_type="application/json")
        assert resp.status_code in (401, 403)

    def test_dlq_list_requires_auth(self, client):
        resp = client.get("/api/v1/dlq/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_dlq_list_org_scoped(self, auth_client, org_fixture, integration_fixture):
        from events.models import DeadLetterQueue, RawWebhookEvent

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="hubspot.contact.created",
            payload={},
            status="failed",
            idempotency_key="dlq-list-evt-001",
        )
        DeadLetterQueue.objects.create(
            raw_event=event,
            organization=org_fixture,
            failure_reason="Timeout",
            retry_count=3,
            status="exhausted",
        )
        resp = auth_client.get("/api/v1/dlq/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert len(results) >= 1
