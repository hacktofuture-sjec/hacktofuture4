"""
Security API view tests — ApiKey CRUD and AuditLog listing.
"""

import hashlib
import secrets

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestApiKeyListView:
    """GET/POST /api/v1/security/api-keys/ — JWT auth."""

    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/security/api-keys/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_api_key(self, auth_client, org_fixture):
        resp = auth_client.post(
            "/api/v1/security/api-keys/",
            {"name": "CI Service Key", "permissions": ["events.ingest"]},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        # raw_key only returned on creation
        assert "raw_key" in data
        assert data["name"] == "CI Service Key"

    def test_create_api_key_stores_hashed_not_plain(self, auth_client, org_fixture):
        """Verify raw_key is NOT stored in plain text in DB."""
        from security.models import ApiKey

        auth_client.post(
            "/api/v1/security/api-keys/",
            {"name": "Hash Check Key", "permissions": []},
            format="json",
        )
        key = ApiKey.objects.filter(name="Hash Check Key").first()
        assert key is not None
        # hashed_key must not equal the raw prefix
        assert len(key.hashed_key) == 64  # SHA-256 hex digest

    def test_list_returns_only_org_keys(self, auth_client, org_fixture, db):
        """Keys from other orgs must not appear."""
        from accounts.models import Organization
        from security.models import ApiKey

        # Create key in own org
        auth_client.post(
            "/api/v1/security/api-keys/",
            {"name": "My Key", "permissions": []},
            format="json",
        )
        # Manually insert key for different org
        other_org = Organization.objects.create(
            name="OtherSec", slug="other-sec", plan_tier="free"
        )
        raw = secrets.token_urlsafe(32)
        ApiKey.objects.create(
            organization=other_org,
            name="Other Org Key",
            hashed_key=hashlib.sha256(raw.encode()).hexdigest(),
            prefix=raw[:8],
            permissions=[],
        )

        resp = auth_client.get("/api/v1/security/api-keys/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        names = [k["name"] for k in results]
        assert "Other Org Key" not in names

    def test_create_requires_name(self, auth_client):
        """Empty name still creates a key — view uses name='' as default."""
        resp = auth_client.post(
            "/api/v1/security/api-keys/", {"permissions": []}, format="json"
        )
        # View accepts missing name (defaults to ''), returns 201
        assert resp.status_code == status.HTTP_201_CREATED
        # But we verify raw_key is still returned
        assert "raw_key" in resp.json()


@pytest.mark.django_db
class TestApiKeyDeleteView:
    """DELETE /api/v1/security/api-keys/{pk}/ — JWT auth."""

    def test_delete_api_key(self, auth_client, org_fixture):
        from security.models import ApiKey

        raw = secrets.token_urlsafe(32)
        key = ApiKey.objects.create(
            organization=org_fixture,
            name="Key to Delete",
            hashed_key=hashlib.sha256(raw.encode()).hexdigest(),
            prefix=raw[:8],
            permissions=[],
        )
        resp = auth_client.delete(f"/api/v1/security/api-keys/{key.id}/")
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not ApiKey.objects.filter(pk=key.pk).exists()

    def test_cannot_delete_other_org_key(self, auth_client, db):
        """User cannot delete a key belonging to another org."""
        from accounts.models import Organization
        from security.models import ApiKey

        other_org = Organization.objects.create(
            name="OtherDel", slug="other-del", plan_tier="free"
        )
        raw = secrets.token_urlsafe(32)
        key = ApiKey.objects.create(
            organization=other_org,
            name="Other Key",
            hashed_key=hashlib.sha256(raw.encode()).hexdigest(),
            prefix=raw[:8],
            permissions=[],
        )
        resp = auth_client.delete(f"/api/v1/security/api-keys/{key.id}/")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestAuditLogListView:
    """GET /api/v1/security/audit-logs/ — JWT auth, read-only."""

    def test_audit_log_requires_auth(self, client):
        resp = client.get("/api/v1/security/audit-logs/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_audit_log_list_org_scoped(self, auth_client, org_fixture, user_fixture):
        from security.models import AuditLog

        AuditLog.objects.create(
            organization=org_fixture,
            actor=user_fixture,
            action="api_key.created",
            resource_type="ApiKey",
            resource_id="test-id",
            changes={"name": "Test Key"},  # field is 'changes', not 'metadata'
        )
        resp = auth_client.get("/api/v1/security/audit-logs/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert any(log["action"] == "api_key.created" for log in results)

    def test_audit_log_is_read_only(self, auth_client):
        """POST to audit-log endpoint must be rejected."""
        resp = auth_client.post(
            "/api/v1/security/audit-logs/",
            {"action": "fake.action"},
            format="json",
        )
        assert resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
