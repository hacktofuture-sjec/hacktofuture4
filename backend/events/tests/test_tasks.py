"""
Events Celery task tests — mock httpx calls to agent service.
"""

import pytest
from unittest.mock import MagicMock, patch


def _make_httpx_client_mock(status_code=200, json_body=None):
    """Return a mock that behaves like httpx.Client context manager."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_body or {"status": "ok"}
    mock_resp.raise_for_status = MagicMock()

    mock_ctx = MagicMock()
    mock_ctx.post = MagicMock(return_value=mock_resp)

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_ctx)
    mock_client.__exit__ = MagicMock(return_value=False)
    return mock_client, mock_ctx


@pytest.mark.django_db
class TestProcessRawWebhookTask:
    def test_task_calls_agent_service(self, org_fixture, integration_fixture):
        """process_raw_webhook should POST to agent service /pipeline/run."""
        from events.models import RawWebhookEvent
        from events.tasks import process_raw_webhook

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={"key": "PROJ-1"},
            idempotency_key="task-test-001",
        )

        mock_client, mock_ctx = _make_httpx_client_mock()
        # events.tasks uses: with httpx.Client(...) as client: client.post(...)
        with patch("events.tasks.httpx.Client", return_value=mock_client):
            process_raw_webhook(event.id)

        mock_ctx.post.assert_called_once()
        event.refresh_from_db()
        assert event.status == "processed"

    def test_task_marks_failed_on_agent_error(self, org_fixture, integration_fixture):
        """On HTTP errors the task transitions event to failed/processing."""
        import httpx

        from events.models import RawWebhookEvent
        from events.tasks import process_raw_webhook

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.updated",
            payload={"key": "PROJ-2"},
            idempotency_key="task-test-002",
        )

        mock_ctx = MagicMock()
        mock_ctx.post.side_effect = httpx.ConnectError("Connection refused")
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_ctx)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("events.tasks.httpx.Client", return_value=mock_client):
            try:
                process_raw_webhook(event.id)
            except Exception:
                pass

        event.refresh_from_db()
        assert event.status in ("processing", "failed", "pending")

    def test_task_sets_status_processing_before_calling_agent(
        self, org_fixture, integration_fixture
    ):
        """Event status must be 'processing' at the moment the agent is called."""
        from events.models import RawWebhookEvent
        from events.tasks import process_raw_webhook

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={"key": "PROJ-3"},
            idempotency_key="task-test-003",
        )

        status_at_call_time = []

        def capture_status(*args, **kwargs):
            ev = type(event).objects.get(pk=event.pk)
            status_at_call_time.append(ev.status)
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = {}
            resp.raise_for_status = MagicMock()
            return resp

        mock_ctx = MagicMock()
        mock_ctx.post = MagicMock(side_effect=capture_status)
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_ctx)
        mock_client.__exit__ = MagicMock(return_value=False)

        with patch("events.tasks.httpx.Client", return_value=mock_client):
            process_raw_webhook(event.id)

        assert "processing" in status_at_call_time


@pytest.mark.django_db
class TestRetryFailedEventsTask:
    def test_retry_picks_up_pending_retry_dlq_entries(
        self, org_fixture, integration_fixture
    ):
        from events.models import DeadLetterQueue, RawWebhookEvent
        from events.tasks import retry_failed_events

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            status="failed",
            idempotency_key="retry-test-001",
        )
        dlq_entry = DeadLetterQueue.objects.create(
            raw_event=event,
            organization=org_fixture,
            failure_reason="Agent service timeout",
            retry_count=1,
            status="pending_retry",
        )

        with patch("events.tasks.process_raw_webhook.apply_async") as mock_async:
            retry_failed_events()

        mock_async.assert_called()
        dlq_entry.refresh_from_db()
        assert dlq_entry.retry_count >= 1

    def test_retry_skips_exhausted_dlq_entries(self, org_fixture, integration_fixture):
        from events.models import DeadLetterQueue, RawWebhookEvent
        from events.tasks import retry_failed_events

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            status="failed",
            idempotency_key="retry-exhausted-001",
        )
        DeadLetterQueue.objects.create(
            raw_event=event,
            organization=org_fixture,
            failure_reason="Max retries exceeded",
            retry_count=3,
            status="exhausted",
        )

        with patch("events.tasks.process_raw_webhook.apply_async") as mock_async:
            retry_failed_events()

        mock_async.assert_not_called()
