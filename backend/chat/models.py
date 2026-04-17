"""
Chat models: ChatSession, ChatMessage.

ChatSession  — multi-turn conversation between a user and the AI agent
ChatMessage  — individual turn (user or assistant), JSONB metadata for tool calls
"""

import uuid

from django.contrib.auth import get_user_model
from django.db import models

from core.models import TimestampedModel

User = get_user_model()

ROLE_CHOICES = [
    ("user", "User"),
    ("assistant", "Assistant"),
    ("system", "System"),
]


class ChatSession(TimestampedModel):
    """
    A conversation session between a user and the AI agent.
    Context JSONB stores active filters / integration scope applied to the session.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "accounts.Organization",
        on_delete=models.CASCADE,
        related_name="chat_sessions",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
    )
    title = models.CharField(
        max_length=500,
        blank=True,
        help_text="Auto-generated from first message",
    )
    context = models.JSONField(
        default=dict,
        help_text="JSONB: active filters, integration scope, date range",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Chat Session"
        verbose_name_plural = "Chat Sessions"
        indexes = [
            models.Index(
                fields=["organization", "user", "-created_at"],
                name="chat_session_org_user_idx",
            )
        ]

    def __str__(self):
        return f"Session[{self.id}] {self.user_id} @ {self.organization_id}"


class ChatMessage(models.Model):
    """
    A single turn in a chat session.
    Metadata JSONB carries LLM sources, tool call results, intermediate reasoning steps.
    """

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    metadata = models.JSONField(
        default=dict,
        help_text="JSONB: LLM sources, tool calls, reasoning steps, citations",
    )
    token_count = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["created_at"]
        indexes = [
            # Ordered for conversation history retrieval
            models.Index(
                fields=["session", "created_at"],
                name="chat_message_session_time_idx",
            )
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
