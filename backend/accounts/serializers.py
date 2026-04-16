"""
Accounts serializers: registration, JWT, org management, RBAC.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Organization,
    OrganizationInvite,
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
    UserProfile,
)

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Augments JWT with user_id, email, org_id."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["user_id"] = str(user.id)
        try:
            token["org_id"] = str(user.profile.organization_id)
        except Exception:
            token["org_id"] = None
        return token


class UserRegistrationSerializer(serializers.Serializer):
    """Creates User + Organization + UserProfile atomically."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    organization_name = serializers.CharField(max_length=255)
    timezone = serializers.CharField(max_length=50, default="UTC")

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        org_name = validated_data.pop("organization_name")
        timezone = validated_data.pop("timezone", "UTC")

        # Ensure unique slug
        base_slug = slugify(org_name)
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization.objects.create(name=org_name, slug=slug)

        # Get or create system owner role
        owner_role, _ = Role.objects.get_or_create(
            name="owner", organization=None, defaults={"is_system": True}
        )

        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
        )

        UserProfile.objects.create(
            user=user, organization=org, timezone=timezone, is_onboarded=False
        )

        OrganizationMember.objects.create(
            organization=org, user=user, role=owner_role
        )

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )

    class Meta:
        model = UserProfile
        fields = [
            "email",
            "first_name",
            "last_name",
            "organization_name",
            "avatar_url",
            "timezone",
            "preferences",
            "is_onboarded",
        ]
        read_only_fields = ["email", "organization_name"]


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "plan_tier",
            "settings",
            "is_active",
            "member_count",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at"]

    def get_member_count(self, obj):
        return obj.members.filter(is_active=True).count()


class OrganizationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["name", "settings"]


class OrganizationMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = OrganizationMember
        fields = [
            "id",
            "user_id",
            "email",
            "full_name",
            "role_name",
            "is_active",
            "joined_at",
        ]
        read_only_fields = ["id", "user_id", "email", "full_name", "joined_at"]

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()


class OrganizationInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationInvite
        fields = [
            "id",
            "email",
            "role",
            "token",
            "status",
            "expires_at",
            "created_at",
        ]
        read_only_fields = ["id", "token", "status", "created_at"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "is_system"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "codename", "description", "resource"]
