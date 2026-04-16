"""Chat serializers + views + URLs."""

from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage, ChatSession


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "metadata", "token_count", "created_at"]
        read_only_fields = ["id", "created_at"]


class ChatSessionSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "title",
            "context",
            "is_active",
            "created_at",
            "updated_at",
            "last_message",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return ChatMessageSerializer(msg).data if msg else None


class ChatSessionListView(generics.ListCreateAPIView):
    serializer_class = ChatSessionSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            ChatSession.objects.filter(organization=org, user=self.request.user)
            .prefetch_related("messages")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        serializer.save(organization=org, user=self.request.user)


class ChatSessionDetailView(generics.RetrieveAPIView):
    serializer_class = ChatSessionSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ChatSession.objects.filter(organization=org, user=self.request.user)


class ChatMessageListView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ChatMessage.objects.filter(
            session_id=self.kwargs["session_id"],
            session__organization=org,
            session__user=self.request.user,
        ).order_by("created_at")


class SendMessageView(APIView):
    """POST /api/v1/chat/sessions/{id}/send/ — stores user msg, proxies to agent."""

    def post(self, request, session_id):
        import httpx
        from django.conf import settings

        org = request.user.profile.organization

        try:
            session = ChatSession.objects.get(
                pk=session_id, organization=org, user=request.user
            )
        except ChatSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        content = request.data.get("content", "").strip()
        if not content:
            return Response(
                {"error": "content is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Store user message
        user_msg = ChatMessage.objects.create(
            session=session, role="user", content=content
        )

        # Auto-title session from first message
        if not session.title:
            session.title = content[:100]
            session.save(update_fields=["title"])

        # Proxy to agent service (sync for simplicity; use SSE for streaming)
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    f"{settings.AGENT_SERVICE_URL}/chat",
                    json={
                        "session_id": str(session_id),
                        "message": content,
                        "context": session.context,
                        "org_id": str(org.id),
                    },
                )
                resp.raise_for_status()
                agent_resp = resp.json()
        except Exception:
            agent_resp = {"content": "Agent service unavailable.", "metadata": {}}

        assistant_msg = ChatMessage.objects.create(
            session=session,
            role="assistant",
            content=agent_resp.get("content", ""),
            metadata=agent_resp.get("metadata", {}),
        )

        return Response(
            {
                "user_message": ChatMessageSerializer(user_msg).data,
                "assistant_message": ChatMessageSerializer(assistant_msg).data,
            },
            status=status.HTTP_201_CREATED,
        )
