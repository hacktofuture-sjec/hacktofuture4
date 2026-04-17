"""
URL configuration — Product Intelligence Platform.

API versioned under /api/v1/
Internal service endpoints use ApiKey auth (marked in each app).
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


def health_check(request):
    """Simple health probe used by Docker and load balancers."""
    return JsonResponse({"status": "ok", "service": "backend"})


urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),
    # Health
    path("health", health_check, name="health"),
    # Auth
    path("api/v1/auth/", include("accounts.urls", namespace="accounts")),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Core platform APIs
    path("api/v1/", include("integrations.urls", namespace="integrations")),
    path("api/v1/", include("events.urls", namespace="events")),
    path("api/v1/", include("processing.urls", namespace="processing")),
    path("api/v1/", include("tickets.urls", namespace="tickets")),
    path("api/v1/", include("insights.urls", namespace="insights")),
    path("api/v1/", include("chat.urls", namespace="chat")),
    path("api/v1/", include("security.urls", namespace="security")),
    path("api/v1/", include("sync.urls", namespace="sync")),
    path("api/v1/", include("queries.urls", namespace="queries")),
]
