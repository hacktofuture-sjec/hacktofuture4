from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import QueryLogViewSet

router = DefaultRouter()
router.register(r"queries", QueryLogViewSet)

urlpatterns = [
    path("api/v1/", include(router.urls)),
]
