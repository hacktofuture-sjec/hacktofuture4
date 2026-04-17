"""
Comprehensive Django admin registrations for all platform apps.

Registered apps:
  - accounts (Organization, OrganizationMember, UserProfile, Role, Permission, OrganizationInvite)
  - integrations (Integration, IntegrationAccount)
  - events (RawWebhookEvent, DeadLetterQueue)
  - processing (ProcessingRun, ProcessingStepLog, MappedPayload, ValidationResult)
  - tickets (UnifiedTicket, TicketActivity, TicketComment, TicketLink, ExternalIdentity)
  - sync (SyncCheckpoint, IdempotencyKey)
  - insights (Insight, InsightSource, Dashboard, DashboardWidget, SavedQuery)
  - chat (ChatSession, ChatMessage)
  - security (ApiKey, AuditLog)
"""

from django.contrib import admin

# ── accounts ──────────────────────────────────────────────────────────────────
from accounts.models import (
    Organization,
    OrganizationInvite,
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
    UserProfile,
)

# ── chat ──────────────────────────────────────────────────────────────────────
from chat.models import ChatMessage, ChatSession

# ── events ────────────────────────────────────────────────────────────────────
from events.models import DeadLetterQueue, RawWebhookEvent

# ── insights ──────────────────────────────────────────────────────────────────
from insights.models import (
    Dashboard,
    DashboardWidget,
    Insight,
    InsightSource,
    SavedQuery,
)

# ── integrations ──────────────────────────────────────────────────────────────
from integrations.models import Integration, IntegrationAccount

# ── processing ────────────────────────────────────────────────────────────────
from processing.models import (
    MappedPayload,
    ProcessingRun,
    ProcessingStepLog,
    ValidationResult,
)

# ── security ──────────────────────────────────────────────────────────────────
from security.models import ApiKey, AuditLog

# ── sync ──────────────────────────────────────────────────────────────────────
from sync.models import IdempotencyKey, SyncCheckpoint

# ── tickets ───────────────────────────────────────────────────────────────────
from tickets.models import (
    ExternalIdentity,
    TicketActivity,
    TicketComment,
    TicketLink,
    UnifiedTicket,
)

# ============================================================================
# accounts
# ============================================================================


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "plan_tier", "is_active", "created_at")
    list_filter = ("plan_tier", "is_active")
    search_fields = ("name", "slug")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "timezone", "is_onboarded")
    list_filter = ("is_onboarded",)
    search_fields = ("user__email", "user__username")
    raw_id_fields = ("user", "organization")


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "is_active", "joined_at")
    list_filter = ("is_active",)
    search_fields = ("user__email", "organization__name")
    raw_id_fields = ("user", "organization", "role")


@admin.register(OrganizationInvite)
class OrganizationInviteAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "status", "expires_at")
    list_filter = ("status",)
    search_fields = ("email", "organization__name")
    readonly_fields = ("token",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "is_system")
    list_filter = ("is_system",)
    search_fields = ("name",)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("codename", "resource", "description")
    list_filter = ("resource",)
    search_fields = ("codename",)


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission")
    raw_id_fields = ("role", "permission")


# ============================================================================
# integrations
# ============================================================================


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "provider", "is_active", "created_at")
    list_filter = ("provider", "is_active")
    search_fields = ("name", "organization__name")
    raw_id_fields = ("organization", "created_by")
    readonly_fields = ("created_at", "updated_at")


@admin.register(IntegrationAccount)
class IntegrationAccountAdmin(admin.ModelAdmin):
    list_display = (
        "external_account_id",
        "integration",
        "organization",
        "is_active",
        "last_synced_at",
    )
    list_filter = ("is_active",)
    search_fields = ("external_account_id", "display_name")
    raw_id_fields = ("integration", "organization")
    readonly_fields = ("last_synced_at",)


# ============================================================================
# events
# ============================================================================


@admin.register(RawWebhookEvent)
class RawWebhookEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "organization",
        "integration",
        "event_type",
        "status",
        "received_at",
    )
    list_filter = ("status", "event_type")
    search_fields = ("event_type", "idempotency_key")
    raw_id_fields = ("organization", "integration")
    readonly_fields = ("payload", "received_at", "idempotency_key")
    ordering = ("-received_at",)


@admin.register(DeadLetterQueue)
class DeadLetterQueueAdmin(admin.ModelAdmin):
    list_display = ("raw_event", "organization", "retry_count", "status", "created_at")
    list_filter = ("status",)
    raw_id_fields = ("raw_event", "organization")
    readonly_fields = ("created_at",)


# ============================================================================
# processing
# ============================================================================


class ProcessingStepLogInline(admin.TabularInline):
    model = ProcessingStepLog
    extra = 0
    readonly_fields = ("step_name", "sequence", "status", "logged_at", "duration_ms")
    can_delete = False


@admin.register(ProcessingRun)
class ProcessingRunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "organization",
        "status",
        "attempt_count",
        "llm_model",
        "started_at",
    )
    list_filter = ("status", "llm_model")
    search_fields = ("id",)
    raw_id_fields = ("organization", "raw_event")
    readonly_fields = ("id", "started_at")
    inlines = [ProcessingStepLogInline]


@admin.register(MappedPayload)
class MappedPayloadAdmin(admin.ModelAdmin):
    list_display = ("processing_run", "organization", "schema_version", "mapped_at")
    raw_id_fields = ("processing_run", "organization")
    readonly_fields = ("mapped_at",)


@admin.register(ValidationResult)
class ValidationResultAdmin(admin.ModelAdmin):
    list_display = ("processing_run", "is_valid", "validated_at")
    list_filter = ("is_valid",)
    raw_id_fields = ("processing_run", "mapped_payload")
    readonly_fields = ("validated_at",)


# ============================================================================
# tickets
# ============================================================================


class TicketActivityInline(admin.TabularInline):
    model = TicketActivity
    extra = 0
    readonly_fields = ("activity_type", "occurred_at", "changes")
    can_delete = False


class TicketCommentInline(admin.TabularInline):
    model = TicketComment
    extra = 0
    readonly_fields = ("body", "author", "created_at")
    can_delete = False


@admin.register(UnifiedTicket)
class UnifiedTicketAdmin(admin.ModelAdmin):
    list_display = (
        "external_ticket_id",
        "title",
        "organization",
        "normalized_status",
        "normalized_type",
        "priority",
        "updated_at",
    )
    list_filter = ("normalized_status", "normalized_type", "priority")
    search_fields = ("title", "external_ticket_id")
    raw_id_fields = ("organization", "integration", "assignee", "reporter")
    readonly_fields = ("created_at", "updated_at")
    inlines = [TicketActivityInline, TicketCommentInline]


@admin.register(ExternalIdentity)
class ExternalIdentityAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "email",
        "external_user_id",
        "integration",
        "organization",
    )
    search_fields = ("email", "display_name", "external_user_id")
    raw_id_fields = ("organization", "integration", "user")


@admin.register(TicketLink)
class TicketLinkAdmin(admin.ModelAdmin):
    list_display = ("source_ticket", "link_type", "target_ticket", "organization")
    list_filter = ("link_type",)
    raw_id_fields = ("organization", "source_ticket", "target_ticket")


# ============================================================================
# sync
# ============================================================================


@admin.register(SyncCheckpoint)
class SyncCheckpointAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "integration_account",
        "checkpoint_key",
        "last_synced_at",
        "records_synced",
    )
    search_fields = ("checkpoint_key",)
    raw_id_fields = ("organization", "integration_account")
    readonly_fields = ("last_synced_at",)


@admin.register(IdempotencyKey)
class IdempotencyKeyAdmin(admin.ModelAdmin):
    list_display = ("key", "organization", "created_at", "expires_at")
    search_fields = ("key",)
    raw_id_fields = ("organization",)
    readonly_fields = ("created_at",)


# ============================================================================
# insights
# ============================================================================


class InsightSourceInline(admin.TabularInline):
    model = InsightSource
    extra = 0
    raw_id_fields = ("ticket", "raw_event")


@admin.register(Insight)
class InsightAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "organization",
        "insight_type",
        "generated_by",
        "confidence_score",
        "is_pinned",
        "created_at",
    )
    list_filter = ("insight_type", "is_pinned")
    search_fields = ("title",)
    raw_id_fields = ("organization",)
    inlines = [InsightSourceInline]


class DashboardWidgetInline(admin.TabularInline):
    model = DashboardWidget
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Dashboard)
class DashboardAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "organization",
        "is_default",
        "is_shared",
        "created_by",
    )
    list_filter = ("is_default", "is_shared")
    search_fields = ("name", "slug")
    raw_id_fields = ("organization", "created_by")
    inlines = [DashboardWidgetInline]


@admin.register(SavedQuery)
class SavedQueryAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "created_by", "created_at")
    search_fields = ("name", "natural_language_query")
    raw_id_fields = ("organization", "created_by")
    readonly_fields = ("created_at",)


# ============================================================================
# chat
# ============================================================================


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ("role", "content", "token_count", "created_at")
    can_delete = False


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "organization", "title", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title", "user__email")
    raw_id_fields = ("user", "organization")
    readonly_fields = ("id", "created_at")
    inlines = [ChatMessageInline]


# ============================================================================
# security
# ============================================================================


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "prefix",
        "is_active",
        "last_used_at",
        "expires_at",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "prefix")
    raw_id_fields = ("organization", "created_by")
    readonly_fields = ("id", "hashed_key", "prefix", "created_at", "last_used_at")
    # Never expose hashed_key as editable — security constraint
    exclude = ()


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "resource_type",
        "resource_id",
        "actor",
        "organization",
        "created_at",
    )
    list_filter = ("action", "resource_type")
    search_fields = ("action", "resource_type", "resource_id", "actor__email")
    raw_id_fields = ("organization", "actor", "api_key")
    readonly_fields = (
        "organization",
        "actor",
        "api_key",
        "action",
        "resource_type",
        "resource_id",
        "changes",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False  # AuditLog is append-only

    def has_change_permission(self, request, obj=None):
        return False  # AuditLog is append-only

    def has_delete_permission(self, request, obj=None):
        return False  # AuditLog is append-only
