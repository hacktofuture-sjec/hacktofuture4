from rest_framework import serializers

from .models import IntegrationConfig


class IntegrationConfigSerializer(serializers.ModelSerializer):
    """Serializer for IntegrationConfig model."""

    class Meta:
        model = IntegrationConfig
        fields = ["id", "name", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
