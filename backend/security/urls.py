"""Security URL conf."""

from django.urls import path

from . import views

app_name = "security"

urlpatterns = [
    path("security/api-keys/", views.ApiKeyListView.as_view(), name="apikey-list"),
    path(
        "security/api-keys/<uuid:pk>/",
        views.ApiKeyDeleteView.as_view(),
        name="apikey-delete",
    ),
    path(
        "security/audit-logs/", views.AuditLogListView.as_view(), name="audit-log-list"
    ),
]
