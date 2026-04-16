"""Events serializers, views, and URL config — all in one file for clarity."""

# ─────────────────────────────────────────────
# serializers.py
# ─────────────────────────────────────────────
import hashlib
import json
import logging

from django.utils import timezone
from rest_framework import serializers

from .models import DeadLetterQueue, RawWebhookEvent

logger = logging.getLogger(__name__)


class EventIngestSerializer(serializers.Serializer):
    """Validates incoming webhook from FastAPI agent service."""

    organization_id = serializers.UUIDField()
    integration_id = serializers.IntegerField()
    integration_account_id = serializers.IntegerField(required=False, allow_null=True)
    event_type = serializers.CharField(max_length=100)
    payload = serializers.JSONField()

    def validate(self, data):
        # Build idempotency key from integration + event_type + payload hash
        payload_str = json.dumps(data["payload"], sort_keys=True)
        payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()[:16]
        data["idempotency_key"] = (
            f"{data['integration_id']}:{data['event_type']}:{payload_hash}"
        )
        return data


class RawWebhookEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawWebhookEvent
        fields = [
            "id",
            "organization",
            "integration",
            "integration_account",
            "event_type",
            "payload",
            "status",
            "idempotency_key",
            "received_at",
            "processed_at",
        ]
        read_only_fields = ["id", "status", "idempotency_key", "received_at"]


class DeadLetterQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeadLetterQueue
        fields = [
            "id",
            "raw_event",
            "organization",
            "failure_reason",
            "error_trace",
            "retry_count",
            "last_retry_at",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DLQIngestSerializer(serializers.Serializer):
    """Payload from FastAPI when a pipeline exhausts retries."""

    event_id = serializers.IntegerField()
    failure_reason = serializers.CharField()
    error_trace = serializers.JSONField(default=dict)
    retry_count = serializers.IntegerField(default=3)
