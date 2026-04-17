from rest_framework import viewsets

from .models import QueryLog
from .serializers import QueryLogSerializer


class QueryLogViewSet(viewsets.ModelViewSet):
    """ViewSet for QueryLog model."""

    queryset = QueryLog.objects.all()
    serializer_class = QueryLogSerializer
