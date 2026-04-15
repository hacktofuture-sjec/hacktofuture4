from rest_framework import serializers

from .models import QueryLog


class QueryLogSerializer(serializers.ModelSerializer):
    """Serializer for QueryLog model."""

    class Meta:
        model = QueryLog
        fields = ["id", "user_query", "timestamp", "response_time"]
        read_only_fields = ["id", "timestamp"]
