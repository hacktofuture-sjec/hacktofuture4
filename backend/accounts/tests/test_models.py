"""
Accounts model tests.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

User = get_user_model()


@pytest.mark.django_db
class TestOrganization:
    def test_organization_created_with_uuid_pk(self, org_fixture):
        import uuid
        assert isinstance(org_fixture.id, uuid.UUID)

    def test_organization_slug_unique(self, org_fixture, db):
        from accounts.models import Organization
        with pytest.raises(IntegrityError):
            Organization.objects.create(name="Dup", slug="test-org")

    def test_organization_str(self, org_fixture):
        assert "Test Org" in str(org_fixture)


@pytest.mark.django_db
class TestUserProfile:
    def test_profile_linked_to_org(self, user_fixture, org_fixture):
        assert user_fixture.profile.organization == org_fixture

    def test_profile_defaults(self, user_fixture):
        assert user_fixture.profile.timezone == "UTC"
        assert user_fixture.profile.is_onboarded is False


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


@pytest.mark.django_db
class TestRBAC:
    def test_role_permission_unique_constraint(self, db):
        from accounts.models import Permission, Role, RolePermission
        from accounts.models import Organization

        perm = Permission.objects.create(
            codename="tickets.view", resource="tickets"
        )
        role = Role.objects.create(name="viewer", is_system=True)
        RolePermission.objects.create(role=role, permission=perm)

        with pytest.raises(IntegrityError):
            RolePermission.objects.create(role=role, permission=perm)
