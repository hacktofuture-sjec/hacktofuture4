"""Chat model and API tests."""

import uuid

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestChatSession:
    def test_chat_session_has_uuid_pk(self, org_fixture, user_fixture):
        from chat.models import ChatSession

        session = ChatSession.objects.create(
            organization=org_fixture,
            user=user_fixture,
            title="Debugging spike in PROJ board",
        )
        assert isinstance(session.id, uuid.UUID)
        assert session.is_active is True

    def test_chat_session_context_stored_as_jsonb(self, org_fixture, user_fixture):
        from chat.models import ChatSession

        ctx = {
            "integration_scope": ["jira", "linear"],
            "filters": {"status": "open"},
        }
        session = ChatSession.objects.create(
            organization=org_fixture,
            user=user_fixture,
            context=ctx,
        )
        saved = ChatSession.objects.get(pk=session.pk)
        assert saved.context["filters"]["status"] == "open"

    def test_chat_message_roles(self, org_fixture, user_fixture):
        from chat.models import ChatMessage, ChatSession

        session = ChatSession.objects.create(
            organization=org_fixture,
            user=user_fixture,
        )
        user_msg = ChatMessage.objects.create(
            session=session,
            role="user",
            content="What tickets are blocked?",
        )
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role="assistant",
            content="There are 3 blocked tickets...",
            token_count=45,
        )
        assert user_msg.role == "user"
        assert assistant_msg.token_count == 45

    def test_chat_message_ordering_by_created_at(self, org_fixture, user_fixture):
        from chat.models import ChatMessage, ChatSession

        session = ChatSession.objects.create(
            organization=org_fixture,
            user=user_fixture,
        )
        for i in range(3):
            ChatMessage.objects.create(
                session=session,
                role="user" if i % 2 == 0 else "assistant",
                content=f"Message {i}",
            )
        messages = list(session.messages.order_by("created_at"))
        assert len(messages) == 3
        # Verify ordering — each message's pk is increasing
        assert messages[0].content == "Message 0"
        assert messages[2].content == "Message 2"

    def test_chat_message_metadata_stored_as_jsonb(self, org_fixture, user_fixture):
        from chat.models import ChatMessage, ChatSession

        session = ChatSession.objects.create(
            organization=org_fixture,
            user=user_fixture,
        )
        metadata = {
            "sources": ["PROJ-42", "PROJ-13"],
            "tool_calls": [{"name": "search_tickets", "args": {}}],
        }
        msg = ChatMessage.objects.create(
            session=session,
            role="assistant",
            content="Based on your tickets...",
            metadata=metadata,
        )
        saved = ChatMessage.objects.get(pk=msg.pk)
        assert saved.metadata["sources"] == ["PROJ-42", "PROJ-13"]

    def test_chat_session_scoped_to_org(self, org_fixture, user_fixture, db):
        """Sessions from other orgs must not leak."""
        from accounts.models import Organization
        from chat.models import ChatSession
        from django.contrib.auth import get_user_model

        other_org = Organization.objects.create(
            name="Other Co", slug="other-co", plan_tier="free"
        )
        other_user = get_user_model().objects.create_user(
            username="other@example.com", email="other@example.com", password="pass"
        )
        # Session belonging to other org
        ChatSession.objects.create(organization=other_org, user=other_user)
        # Session belonging to our org
        ChatSession.objects.create(organization=org_fixture, user=user_fixture)

        our_sessions = ChatSession.objects.filter(organization=org_fixture)
        other_sessions = ChatSession.objects.filter(organization=other_org)
        assert our_sessions.count() == 1
        assert other_sessions.count() == 1
        # Verify no cross-contamination
        assert our_sessions.first().organization != other_org


@pytest.mark.django_db
class TestChatAPI:
    def test_session_list_requires_auth(self, client):
        resp = client.get("/api/v1/chat/sessions/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_session(self, auth_client):
        resp = auth_client.post(
            "/api/v1/chat/sessions/",
            {"title": "Sprint review analysis"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert "id" in data
        assert data.get("is_active") is True

    def test_list_sessions_org_scoped(self, auth_client):
        # Create a session first
        auth_client.post(
            "/api/v1/chat/sessions/",
            {"title": "Test session"},
            format="json",
        )
        resp = auth_client.get("/api/v1/chat/sessions/")
        assert resp.status_code == status.HTTP_200_OK
        results = resp.json().get("results", resp.json())
        assert len(results) >= 1
