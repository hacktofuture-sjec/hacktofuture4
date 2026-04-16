"""
Processing pipeline model tests — matches actual model schema.
"""

import uuid

import pytest


@pytest.mark.django_db
class TestProcessingRun:
    def test_processing_run_has_uuid_pk(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent
        from processing.models import ProcessingRun

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="proc-run-test-001",
        )
        run = ProcessingRun.objects.create(
            organization=org_fixture,
            raw_event=event,
            source="jira",
            llm_model="gpt-4o",
        )
        assert isinstance(run.id, uuid.UUID)
        # Default status is "started" (first choice in STATUS_CHOICES)
        assert run.status == "started"
        assert run.attempt_count == 1

    def test_processing_run_status_can_transition(
        self, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent
        from processing.models import ProcessingRun

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="proc-run-status-001",
        )
        run = ProcessingRun.objects.create(
            organization=org_fixture,
            raw_event=event,
            source="jira",
            llm_model="gpt-4o",
        )
        run.status = "completed"
        run.save(update_fields=["status"])
        refreshed = type(run).objects.get(pk=run.pk)
        assert refreshed.status == "completed"

    def test_processing_step_log_records_sequence(
        self, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent
        from processing.models import ProcessingRun, ProcessingStepLog

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="proc-step-test-001",
        )
        run = ProcessingRun.objects.create(
            organization=org_fixture,
            raw_event=event,
            source="jira",
            llm_model="gpt-4o",
        )
        for i, step_name in enumerate(["fetcher", "mapper", "validator"]):
            ProcessingStepLog.objects.create(
                processing_run=run,
                step_name=step_name,
                sequence=i + 1,
                status="completed",
                input_data={"attempt": i},
                output_data={"step": step_name},
            )

        logs = run.step_logs.order_by("sequence")
        assert logs.count() == 3
        expected = ["fetcher", "mapper", "validator"]
        assert [e.step_name for e in logs] == expected

    def test_mapped_payload_stores_jsonb(self, org_fixture, integration_fixture):
        from events.models import RawWebhookEvent
        from processing.models import MappedPayload, ProcessingRun

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="proc-mapped-test-001",
        )
        run = ProcessingRun.objects.create(
            organization=org_fixture,
            raw_event=event,
            source="jira",
            llm_model="gpt-4o",
        )
        mapped_data = {
            "external_ticket_id": "PROJ-1",
            "title": "Bug fix",
            "normalized_status": "open",
        }
        # MappedPayload requires: processing_run + organization + mapped_data
        mp = MappedPayload.objects.create(
            processing_run=run,
            organization=org_fixture,
            mapped_data=mapped_data,
        )
        saved = MappedPayload.objects.get(pk=mp.pk)
        assert saved.mapped_data["normalized_status"] == "open"
        assert saved.schema_version == "v1"

    def test_validation_result_linked_to_processing_run(
        self, org_fixture, integration_fixture
    ):
        from events.models import RawWebhookEvent
        from processing.models import MappedPayload, ProcessingRun, ValidationResult

        event = RawWebhookEvent.objects.create(
            organization=org_fixture,
            integration=integration_fixture,
            event_type="jira.issue.created",
            payload={},
            idempotency_key="proc-validation-test-001",
        )
        run = ProcessingRun.objects.create(
            organization=org_fixture,
            raw_event=event,
            source="jira",
            llm_model="gpt-4o",
        )
        # ValidationResult requires a MappedPayload FK (not null)
        mp = MappedPayload.objects.create(
            processing_run=run,
            organization=org_fixture,
            mapped_data={"normalized_status": "open"},
        )
        vr = ValidationResult.objects.create(
            processing_run=run,
            mapped_payload=mp,
            is_valid=True,
            validation_errors=[],
        )
        assert vr.processing_run == run
        assert vr.is_valid is True
        assert vr.mapped_payload == mp
