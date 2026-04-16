"""
Tickets serializers.

UnifiedTicketListSerializer  — lightweight for list views
UnifiedTicketDetailSerializer — full detail with related data
TicketUpsertSerializer       — idempotent upsert (FastAPI → Django)
"""

from rest_framework import serializers

from .models import (
    ExternalIdentity,
    TicketActivity,
    TicketComment,
    TicketLink,
    UnifiedTicket,
)


class ExternalIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalIdentity
        fields = [
            "id",
            "external_user_id",
            "display_name",
            "email",
            "avatar_url",
            "integration",
        ]


class TicketActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name", read_only=True)

    class Meta:
        model = TicketActivity
        fields = [
            "id",
            "activity_type",
            "actor_id",
            "actor_name",
            "changes",
            "occurred_at",
            "created_at",
        ]


class TicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.display_name", read_only=True)

    class Meta:
        model = TicketComment
        fields = [
            "id",
            "external_comment_id",
            "author_id",
            "author_name",
            "body",
            "body_html",
            "is_internal",
            "source_created_at",
            "created_at",
        ]


class TicketLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketLink
        fields = ["id", "source_ticket", "target_ticket", "link_type", "created_at"]


class UnifiedTicketListSerializer(serializers.ModelSerializer):
    """Lightweight serializer optimised for list views via covering index."""

    assignee_name = serializers.CharField(
        source="assignee.display_name", read_only=True
    )

    class Meta:
        model = UnifiedTicket
        fields = [
            "id",
            "external_ticket_id",
            "title",
            "normalized_status",
            "normalized_type",
            "priority",
            "assignee_id",
            "assignee_name",
            "due_date",
            "created_at",
            "updated_at",
        ]


class UnifiedTicketDetailSerializer(serializers.ModelSerializer):
    """Full detail: activities, comments, links, identity info."""

    activities = TicketActivitySerializer(many=True, read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    outgoing_links = TicketLinkSerializer(many=True, read_only=True)
    assignee = ExternalIdentitySerializer(read_only=True)
    reporter = ExternalIdentitySerializer(read_only=True)

    class Meta:
        model = UnifiedTicket
        fields = [
            "id",
            "external_ticket_id",
            "integration",
            "title",
            "description",
            "normalized_status",
            "normalized_type",
            "priority",
            "assignee",
            "reporter",
            "due_date",
            "provider_metadata",
            "labels",
            "source_created_at",
            "source_updated_at",
            "created_at",
            "updated_at",
            "activities",
            "comments",
            "outgoing_links",
        ]


class TicketUpsertSerializer(serializers.Serializer):
    """
    Idempotent upsert payload sent by FastAPI agent after successful pipeline.
    Key: (integration_id, external_ticket_id)
    """

    organization_id = serializers.UUIDField()
    integration_id = serializers.IntegerField()
    integration_account_id = serializers.IntegerField(required=False, allow_null=True)
    processing_run_id = serializers.UUIDField(required=False, allow_null=True)
    external_ticket_id = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=1000)
    description = serializers.CharField(default="", allow_blank=True)
    normalized_status = serializers.ChoiceField(
        choices=["open", "in_progress", "blocked", "resolved"]
    )
    normalized_type = serializers.ChoiceField(
        choices=["bug", "feature", "task", "epic", "story", "subtask", "other"],
        default="task",
    )
    priority = serializers.ChoiceField(
        choices=["critical", "high", "medium", "low", "none"], default="none"
    )
    assignee_external_id = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    reporter_external_id = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    provider_metadata = serializers.JSONField(default=dict)
    labels = serializers.ListField(
        child=serializers.CharField(), default=list, allow_empty=True
    )
    source_created_at = serializers.DateTimeField(required=False, allow_null=True)
    source_updated_at = serializers.DateTimeField(required=False, allow_null=True)
