"""
Security model tests — ApiKey, AuditLog.
"""

import hashlib
import secrets

import pytest
from django.db import IntegrityError


@pytest.mark.django_db
class TestApiKeyModel:
    def test_api_key_hashed_key_stored_not_raw(self, org_fixture, user_fixture):
        from security.models import ApiKey

        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()

        api_key = ApiKey.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Test Key",
            hashed_key=hashed,
            prefix=raw_key[:8],
            permissions=["events.ingest"],
        )
        assert api_key.hashed_key == hashed
        assert raw_key not in [api_key.hashed_key, api_key.prefix]

    def test_api_key_hashed_key_is_unique(self, org_fixture, user_fixture):
        from security.models import ApiKey

        key1 = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(key1.encode()).hexdigest()

        ApiKey.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Key A",
            hashed_key=hashed,
            prefix=key1[:8],
        )
        with pytest.raises(IntegrityError):
            ApiKey.objects.create(
                organization=org_fixture,
                created_by=user_fixture,
                name="Key B Duplicate",
                hashed_key=hashed,
                prefix=key1[:8],
            )

    def test_api_key_permissions_stored_as_jsonb_list(self, org_fixture, user_fixture):
        from security.models import ApiKey

        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()

        api_key = ApiKey.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Scoped Key",
            hashed_key=hashed,
            prefix=raw_key[:8],
            permissions=["events.ingest", "tickets.upsert"],
        )
        refreshed = type(api_key).objects.get(pk=api_key.pk)
        assert "events.ingest" in refreshed.permissions
        assert "tickets.upsert" in refreshed.permissions

    def test_api_key_auth_validates_correct_key(self, org_fixture, user_fixture):
        """Simulate the HasApiKey auth flow."""
        from security.models import ApiKey

        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()

        ApiKey.objects.create(
            organization=org_fixture,
            created_by=user_fixture,
            name="Auth Test Key",
            hashed_key=hashed,
            prefix=raw_key[:8],
            permissions=["events.ingest"],
        )
        # Simulate lookup: hash the provided key and look it up
        lookup_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        found = ApiKey.objects.filter(hashed_key=lookup_hash, is_active=True).exists()
        assert found is True

    def test_wrong_api_key_not_found(self, org_fixture, user_fixture):
        from security.models import ApiKey

        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()
        ApiKey.objects.create(
            organization=org_fixture,
            name="Real Key",
            hashed_key=hashed,
            prefix=raw_key[:8],
        )
        wrong_hash = hashlib.sha256(b"wrongkey").hexdigest()
        found = ApiKey.objects.filter(hashed_key=wrong_hash, is_active=True).exists()
        assert found is False


@pytest.mark.django_db
class TestAuditLog:
    def test_audit_log_append_only_raises_on_update(self, org_fixture, user_fixture):
        from security.models import AuditLog

        log = AuditLog.objects.create(
            organization=org_fixture,
            actor=user_fixture,
            action="ticket.upsert",
            resource_type="ticket",
            resource_id="PROJ-1",
        )
        with pytest.raises(PermissionError, match="immutable"):
            log.action = "ticket.delete"
            log.save()

    def test_audit_log_str_representation(self, org_fixture, user_fixture):
        from security.models import AuditLog

        log = AuditLog.objects.create(
            organization=org_fixture,
            actor=user_fixture,
            action="integration.create",
            resource_type="integration",
        )
        assert str(log)

    def test_audit_log_changes_jsonb(self, org_fixture, user_fixture):
        from security.models import AuditLog

        log = AuditLog.objects.create(
            organization=org_fixture,
            actor=user_fixture,
            action="ticket.status_change",
            resource_type="ticket",
            resource_id="PROJ-5",
            changes={"before": {"status": "open"}, "after": {"status": "resolved"}},
        )
        refreshed = AuditLog.objects.get(pk=log.pk)
        assert refreshed.changes["after"]["status"] == "resolved"
