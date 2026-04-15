from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IntegrationConfigViewSet

router = DefaultRouter()
router.register(r"integrations", IntegrationConfigViewSet)

urlpatterns = [
    path("api/v1/", include(router.urls)),
]
