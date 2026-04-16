"""Security serializers + views + URLs."""

import hashlib
import secrets

from rest_framework import generics, serializers, status
from rest_framework.response import Response

from .models import ApiKey, AuditLog


class ApiKeyCreateSerializer(serializers.ModelSerializer):
    """On creation, returns the raw key once (never again stored)."""

    raw_key = serializers.SerializerMethodField()

    class Meta:
        model = ApiKey
        fields = [
            "id",
            "name",
            "permissions",
            "rate_limit_per_minute",
            "expires_at",
            "raw_key",
        ]
        read_only_fields = ["id", "raw_key"]

    def get_raw_key(self, obj):
        return getattr(obj, "_raw_key", None)


class ApiKeyListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = [
            "id",
            "name",
            "prefix",
            "permissions",
            "is_active",
            "last_used_at",
            "expires_at",
            "created_at",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_id",
            "actor_email",
            "action",
            "resource_type",
            "resource_id",
            "changes",
            "ip_address",
            "created_at",
        ]


class ApiKeyListView(generics.ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == "POST":
            return ApiKeyCreateSerializer
        return ApiKeyListSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ApiKey.objects.filter(organization=org).order_by("-created_at")

    def create(self, request, *args, **kwargs):
        org = request.user.profile.organization
        raw_key = secrets.token_urlsafe(32)
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()
        prefix = raw_key[:8]

        api_key = ApiKey.objects.create(
            organization=org,
            created_by=request.user,
            name=request.data.get("name", ""),
            hashed_key=hashed,
            prefix=prefix,
            permissions=request.data.get("permissions", []),
            rate_limit_per_minute=request.data.get("rate_limit_per_minute", 60),
            expires_at=request.data.get("expires_at"),
        )
        api_key._raw_key = raw_key  # Attach for serializer to read once

        serializer = ApiKeyCreateSerializer(api_key)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ApiKeyDeleteView(generics.DestroyAPIView):
    def get_queryset(self):
        org = self.request.user.profile.organization
        return ApiKey.objects.filter(organization=org)


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return AuditLog.objects.filter(organization=org).order_by("-created_at")
