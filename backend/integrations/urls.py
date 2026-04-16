"""Integrations URL conf."""

from django.urls import path

from . import views

app_name = "integrations"

urlpatterns = [
    path("integrations/", views.IntegrationListView.as_view(), name="integration-list"),
    path("integrations/<int:pk>/", views.IntegrationDetailView.as_view(), name="integration-detail"),
    path(
        "integrations/<int:integration_id>/accounts/",
        views.IntegrationAccountListView.as_view(),
        name="integration-account-list",
    ),
    path(
        "integrations/<int:integration_id>/accounts/<int:account_id>/sync/",
        views.IntegrationSyncView.as_view(),
        name="integration-sync",
    ),
]
