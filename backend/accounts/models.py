"""
Accounts models: Organization, RBAC, Membership, Invites, UserProfile.

All multi-tenancy in the platform roots back to Organization.
Every user belongs to exactly one org at signup; they can be invited
to additional orgs as OrganizationMember.
"""

import uuid

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Q

from core.models import TimestampedModel

User = get_user_model()


# ---------------------------------------------------------------------------
# RBAC Primitives (no org dependency — defined first)
# ---------------------------------------------------------------------------


class Permission(models.Model):
    """
    Fine-grained permission codename.
    Codenames use dot notation: resource.action
    e.g. tickets.view, tickets.create, integrations.manage
    """

    codename = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    resource = models.CharField(
        max_length=50,
        help_text="Resource group: tickets, insights, chat, integrations, etc.",
    )

    class Meta:
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        ordering = ["resource", "codename"]

    def __str__(self):
        return self.codename


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------


class Organization(TimestampedModel):
    """
    Top-level multi-tenancy container.
    Every org-scoped model carries a FK to this.
    """

    PLAN_CHOICES = [
        ("free", "Free"),
        ("starter", "Starter"),
        ("pro", "Pro"),
        ("enterprise", "Enterprise"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    plan_tier = models.CharField(max_length=20, choices=PLAN_CHOICES, default="free")
    settings = models.JSONField(
        default=dict,
        help_text="JSONB: feature flags, limits, provider config overrides",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        indexes = [
            models.Index(fields=["slug"], name="org_slug_idx"),
            models.Index(fields=["is_active"], name="org_active_idx"),
            models.Index(fields=["plan_tier"], name="org_plan_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"


# ---------------------------------------------------------------------------
# RBAC — Role (org-scoped or system)
# ---------------------------------------------------------------------------


class Role(TimestampedModel):
    """
    Named role within an organization (or a system-wide role if org=null).
    System roles: owner, admin, member, viewer
    Custom roles: org-specific definitions.
    """

    name = models.CharField(max_length=100)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
        help_text="Null = system-wide role available to all orgs",
    )
    is_system = models.BooleanField(default=False)
    permissions = models.ManyToManyField(
        Permission,
        through="RolePermission",
        related_name="roles",
        blank=True,
    )

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        constraints = [
            models.UniqueConstraint(
                fields=["name", "organization"],
                name="unique_role_name_per_org",
            )
        ]

    def __str__(self):
        return f"{self.name} ({'system' if self.is_system else self.organization_id})"


class RolePermission(models.Model):
    """Through model for Role ↔ Permission M2M."""

    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="role_permissions"
    )
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"], name="unique_role_permission"
            )
        ]


# ---------------------------------------------------------------------------
# Organization Membership
# ---------------------------------------------------------------------------


class OrganizationMember(TimestampedModel):
    """User ↔ Organization membership with an assigned Role."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="org_memberships",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Organization Member"
        verbose_name_plural = "Organization Members"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_org_member",
            )
        ]
        indexes = [
            models.Index(
                fields=["organization", "user"],
                name="orgmember_org_user_idx",
            ),
            models.Index(
                fields=["organization", "role"],
                name="orgmember_org_role_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.organization_id} ({self.role.name})"


# ---------------------------------------------------------------------------
# Organization Invite
# ---------------------------------------------------------------------------


class OrganizationInvite(TimestampedModel):
    """
    Token-based email invite. One pending invite per (org, email) enforced
    via partial unique constraint.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("expired", "Expired"),
        ("revoked", "Revoked"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invites",
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_invites",
    )
    email = models.EmailField()
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="invites",
    )
    token = models.UUIDField(unique=True, default=uuid.uuid4)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = "Organization Invite"
        verbose_name_plural = "Organization Invites"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "email"],
                condition=Q(status="pending"),
                name="unique_pending_invite_per_org_email",
            )
        ]
        indexes = [
            models.Index(fields=["token"], name="invite_token_idx"),
            models.Index(fields=["email", "status"], name="invite_email_status_idx"),
        ]

    def __str__(self):
        return f"Invite {self.email} → {self.organization_id} [{self.status}]"


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------


class UserProfile(TimestampedModel):
    """Extended profile attached to Django's built-in User via OneToOne."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profiles",
        help_text="Primary (home) organization of the user",
    )
    avatar_url = models.URLField(blank=True)
    timezone = models.CharField(max_length=50, default="UTC")
    preferences = models.JSONField(
        default=dict,
        help_text="JSONB: UI preferences, notification settings, etc.",
    )
    is_onboarded = models.BooleanField(default=False)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        indexes = [
            models.Index(fields=["organization"], name="profile_org_idx"),
        ]

    def __str__(self):
        return f"Profile({self.user_id})"
