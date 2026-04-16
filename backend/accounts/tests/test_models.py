"""
Comprehensive accounts model tests.
"""

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

User = get_user_model()


@pytest.mark.django_db
class TestOrganization:
    def test_organization_created_with_uuid_pk(self, org_fixture):
        assert isinstance(org_fixture.id, uuid.UUID)

    def test_organization_slug_unique(self, org_fixture):
        from accounts.models import Organization

        with pytest.raises(IntegrityError):
            Organization.objects.create(name="Dup", slug="test-org")

    def test_organization_str_contains_name(self, org_fixture):
        assert "Test Org" in str(org_fixture)

    def test_organization_default_plan_tier(self, org_fixture):
        assert org_fixture.plan_tier in ["free", "pro", "enterprise"]

    def test_organization_is_active_by_default(self, org_fixture):
        assert org_fixture.is_active is True

    def test_organization_settings_is_jsonb(self, org_fixture):
        """Settings field must default to a dict (JSONB in postgres)."""
        assert isinstance(org_fixture.settings, dict)


@pytest.mark.django_db
class TestUserProfile:
    def test_profile_linked_to_org(self, user_fixture, org_fixture):
        assert user_fixture.profile.organization == org_fixture

    def test_profile_defaults(self, user_fixture):
        assert user_fixture.profile.timezone == "UTC"
        assert user_fixture.profile.is_onboarded is False

    def test_profile_preferences_is_dict(self, user_fixture):
        assert isinstance(user_fixture.profile.preferences, dict)

    def test_profile_str_representation(self, user_fixture):
        assert str(user_fixture.profile)


@pytest.mark.django_db
class TestOrganizationMember:
    def test_unique_member_constraint(self, user_fixture, org_fixture, role_fixture):
        from accounts.models import OrganizationMember

        with pytest.raises(IntegrityError):
            OrganizationMember.objects.create(
                organization=org_fixture, user=user_fixture, role=role_fixture
            )

    def test_member_role_assignment(self, user_fixture, org_fixture):
        membership = user_fixture.org_memberships.get(organization=org_fixture)
        assert membership.role.name == "owner"

    def test_member_is_active_by_default(self, user_fixture, org_fixture):
        membership = user_fixture.org_memberships.get(organization=org_fixture)
        assert membership.is_active is True

    def test_member_joined_at_is_set(self, user_fixture, org_fixture):
        membership = user_fixture.org_memberships.get(organization=org_fixture)
        assert membership.joined_at is not None


@pytest.mark.django_db
class TestRBAC:
    def test_role_permission_unique_constraint(self, db):
        from accounts.models import Permission, Role, RolePermission

        perm = Permission.objects.create(codename="tickets.view", resource="tickets")
        role = Role.objects.create(name="viewer", is_system=True)
        RolePermission.objects.create(role=role, permission=perm)

        with pytest.raises(IntegrityError):
            RolePermission.objects.create(role=role, permission=perm)

    def test_system_role_is_flagged(self, db):
        from accounts.models import Role

        role = Role.objects.create(name="admin", is_system=True)
        assert role.is_system is True

    def test_permission_codename_unique(self, db):
        from accounts.models import Permission

        Permission.objects.create(codename="events.ingest", resource="events")
        with pytest.raises(Exception):
            Permission.objects.create(codename="events.ingest", resource="events")


@pytest.mark.django_db
class TestOrganizationInvite:
    def test_invite_created_with_token(self, org_fixture, user_fixture, role_fixture):
        from datetime import timedelta

        from django.utils import timezone

        from accounts.models import OrganizationInvite

        invite = OrganizationInvite.objects.create(
            organization=org_fixture,
            invited_by=user_fixture,
            email="newbie@example.com",
            role=role_fixture,
            expires_at=timezone.now() + timedelta(days=7),
        )
        assert invite.token is not None
        assert invite.status == "pending"

    def test_duplicate_pending_invite_per_org_email_fails(
        self, org_fixture, user_fixture, role_fixture
    ):
        from datetime import timedelta

        from django.utils import timezone

        from accounts.models import OrganizationInvite

        OrganizationInvite.objects.create(
            organization=org_fixture,
            invited_by=user_fixture,
            email="shared@example.com",
            role=role_fixture,
            expires_at=timezone.now() + timedelta(days=7),
        )
        with pytest.raises(IntegrityError):
            OrganizationInvite.objects.create(
                organization=org_fixture,
                invited_by=user_fixture,
                email="shared@example.com",
                role=role_fixture,
                expires_at=timezone.now() + timedelta(days=7),
            )
