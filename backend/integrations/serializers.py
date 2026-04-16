"""Integrations serializers."""

from rest_framework import serializers

from .models import Integration, IntegrationAccount


class IntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Integration
        fields = [
            "id",
            "provider",
            "name",
            "config",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IntegrationAccountSerializer(serializers.ModelSerializer):
    credentials = serializers.JSONField(write_only=True)  # Write-only on API

    class Meta:
        model = IntegrationAccount
        fields = [
            "id",
            "integration",
            "external_account_id",
            "display_name",
            "credentials",
            "scopes",
            "token_expires_at",
            "is_active",
            "last_synced_at",
        ]
        read_only_fields = ["id", "last_synced_at"]
