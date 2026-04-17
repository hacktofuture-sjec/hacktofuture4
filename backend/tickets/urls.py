"""Tickets URL configuration."""

from django.urls import path

from . import views

app_name = "tickets"

urlpatterns = [
    path("tickets/upsert", views.TicketUpsertView.as_view(), name="upsert"),
    path("tickets/", views.TicketListView.as_view(), name="ticket-list"),
    path("tickets/<int:pk>/", views.TicketDetailView.as_view(), name="ticket-detail"),
    path(
        "tickets/<int:ticket_id>/activities/",
        views.TicketActivityListView.as_view(),
        name="ticket-activities",
    ),
    path(
        "tickets/<int:ticket_id>/comments/",
        views.TicketCommentListView.as_view(),
        name="ticket-comments",
    ),
    path("identities/map", views.IdentityMapView.as_view(), name="identity-map"),
]
