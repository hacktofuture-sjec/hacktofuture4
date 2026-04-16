"""Events URL configuration."""

from django.urls import path

from . import views

app_name = "events"

urlpatterns = [
    path("events/ingest", views.EventIngestView.as_view(), name="ingest"),
    path("events/", views.RawWebhookEventListView.as_view(), name="event-list"),
    path("events/<int:pk>/", views.RawWebhookEventDetailView.as_view(), name="event-detail"),
    path("dlq", views.DLQIngestView.as_view(), name="dlq-ingest"),
    path("dlq/", views.DLQListView.as_view(), name="dlq-list"),
    path("dlq/<int:pk>/retry/", views.DLQRetryView.as_view(), name="dlq-retry"),
]
