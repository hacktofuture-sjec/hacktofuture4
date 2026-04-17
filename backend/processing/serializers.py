"""Processing serializers."""

from rest_framework import serializers

from .models import ProcessingRun, ProcessingStepLog, ValidationResult


class ProcessingStepLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessingStepLog
        fields = [
            "id",
            "step_name",
            "sequence",
            "status",
            "input_data",
            "output_data",
            "error_message",
            "duration_ms",
            "logged_at",
        ]


class ValidationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationResult
        fields = ["is_valid", "validation_errors", "validated_at"]


class ProcessingRunSerializer(serializers.ModelSerializer):
    step_logs = ProcessingStepLogSerializer(many=True, read_only=True)
    validation_result = ValidationResultSerializer(read_only=True)

    class Meta:
        model = ProcessingRun
        fields = [
            "id",
            "raw_event_id",
            "status",
            "attempt_count",
            "llm_model",
            "source",
            "started_at",
            "completed_at",
            "duration_ms",
            "step_logs",
            "validation_result",
        ]
