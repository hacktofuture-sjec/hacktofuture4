"""
Backend test configuration and shared fixtures.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def org_fixture(db):
    """Create a test Organization."""
    from accounts.models import Organization

    return Organization.objects.create(
        name="Test Org",
        slug="test-org",
        plan_tier="pro",
    )


@pytest.fixture
def role_fixture(db):
    """Create system roles."""
    from accounts.models import Role

    owner, _ = Role.objects.get_or_create(name="owner", defaults={"is_system": True})
    return owner


@pytest.fixture
def user_fixture(db, org_fixture, role_fixture):
    """Create a test User with Profile and Org membership."""
    from accounts.models import OrganizationMember, UserProfile

    user = User.objects.create_user(
        username="test@example.com",
        email="test@example.com",
        password="Securepass123!",
        first_name="Test",
        last_name="User",
    )
    UserProfile.objects.create(user=user, organization=org_fixture)
    OrganizationMember.objects.create(
        organization=org_fixture, user=user, role=role_fixture
    )
    return user


@pytest.fixture
def auth_client(user_fixture):
    """APIClient authenticated with JWT token."""
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    refresh = RefreshToken.for_user(user_fixture)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.fixture
def api_key_fixture(db, org_fixture):
    """Create an ApiKey for service-to-service auth tests."""
    import hashlib
    import secrets

    from security.models import ApiKey

    raw_key = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw_key.encode()).hexdigest()

    api_key = ApiKey.objects.create(
        organization=org_fixture,
        name="Test Service Key",
        hashed_key=hashed,
        prefix=raw_key[:8],
        permissions=["events.ingest", "tickets.upsert"],
    )
    api_key._raw_key = raw_key
    return api_key


@pytest.fixture
def integration_fixture(db, org_fixture, user_fixture):
    """Create a test Integration."""
    from integrations.models import Integration

    return Integration.objects.create(
        organization=org_fixture,
        created_by=user_fixture,
        provider="jira",
        name="Test Jira",
        config={"base_url": "https://test.atlassian.net"},
    )
