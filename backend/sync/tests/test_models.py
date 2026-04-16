"""
Sync models tests — SyncCheckpoint, IdempotencyKey.
"""

import pytest
from django.utils import timezone


@pytest.mark.django_db
class TestSyncCheckpoint:
    def test_checkpoint_created_with_jsonb_value(
        self, org_fixture, integration_fixture
    ):
        from integrations.models import IntegrationAccount
        from sync.models import SyncCheckpoint

        account = IntegrationAccount.objects.create(
            integration=integration_fixture,
            organization=org_fixture,
            external_account_id="ACME-JIRA-PROD",
            credentials={},
        )
        checkpoint, created = SyncCheckpoint.objects.get_or_create(
            organization=org_fixture,
            integration_account=account,
            checkpoint_key="jira_sync_cursor",
            defaults={"checkpoint_value": {"since": "2024-01-01T00:00:00Z"}},
        )
        assert created is True
        assert checkpoint.checkpoint_value["since"] == "2024-01-01T00:00:00Z"

    def test_checkpoint_unique_per_org_account_key(
        self, org_fixture, integration_fixture
    ):
        from django.db import IntegrityError

        from integrations.models import IntegrationAccount
        from sync.models import SyncCheckpoint

        account = IntegrationAccount.objects.create(
            integration=integration_fixture,
            organization=org_fixture,
            external_account_id="ACME-JIRA-PROD-2",
            credentials={},
        )
        SyncCheckpoint.objects.create(
            organization=org_fixture,
            integration_account=account,
            checkpoint_key="jira_sync_cursor",
            checkpoint_value={},
        )
        with pytest.raises(IntegrityError):
            SyncCheckpoint.objects.create(
                organization=org_fixture,
                integration_account=account,
                checkpoint_key="jira_sync_cursor",
                checkpoint_value={"duplicate": True},
            )


@pytest.mark.django_db
class TestIdempotencyKey:
    def test_idempotency_key_lookup(self, org_fixture):
        from sync.models import IdempotencyKey

        IdempotencyKey.objects.create(
            organization=org_fixture,
            key="sha256:abc123",
            expires_at=timezone.now(),
        )
        exists = IdempotencyKey.objects.filter(
            organization=org_fixture, key="sha256:abc123"
        ).exists()
        assert exists is True

    def test_duplicate_key_raises_integrity_error(self, org_fixture):
        from django.db import IntegrityError

        from sync.models import IdempotencyKey

        IdempotencyKey.objects.create(
            organization=org_fixture,
            key="sha256:unique-key-001",
            expires_at=timezone.now(),
        )
        with pytest.raises(IntegrityError):
            IdempotencyKey.objects.create(
                organization=org_fixture,
                key="sha256:unique-key-001",
                expires_at=timezone.now(),
            )
