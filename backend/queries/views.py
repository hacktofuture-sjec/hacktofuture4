from rest_framework import viewsets

from .models import IntegrationConfig
from .serializers import IntegrationConfigSerializer


class IntegrationConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for IntegrationConfig model."""

    queryset = IntegrationConfig.objects.all()
    serializer_class = IntegrationConfigSerializer
