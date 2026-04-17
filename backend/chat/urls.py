"""Chat URL conf."""

from django.urls import path

from . import views

app_name = "chat"

urlpatterns = [
    path("chat/sessions/", views.ChatSessionListView.as_view(), name="session-list"),
    path(
        "chat/sessions/<uuid:pk>/",
        views.ChatSessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "chat/sessions/<uuid:session_id>/messages/",
        views.ChatMessageListView.as_view(),
        name="message-list",
    ),
    path(
        "chat/sessions/<uuid:session_id>/send/",
        views.SendMessageView.as_view(),
        name="send-message",
    ),
]
