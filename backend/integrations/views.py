"""Integrations views."""

import logging

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Integration, IntegrationAccount
from .serializers import IntegrationAccountSerializer, IntegrationSerializer

logger = logging.getLogger(__name__)


class IntegrationListView(generics.ListCreateAPIView):
    serializer_class = IntegrationSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return Integration.objects.filter(organization=org).order_by("name")

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        serializer.save(organization=org, created_by=self.request.user)


class IntegrationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = IntegrationSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return Integration.objects.filter(organization=org)


class IntegrationAccountListView(generics.ListCreateAPIView):
    serializer_class = IntegrationAccountSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return IntegrationAccount.objects.filter(
            organization=org, integration_id=self.kwargs["integration_id"]
        )

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        serializer.save(
            organization=org,
            integration_id=self.kwargs["integration_id"],
        )


class IntegrationSyncView(APIView):
    """POST /api/v1/integrations/{id}/accounts/{account_id}/sync/"""

    def post(self, request, integration_id, account_id):
        from tickets.tasks import sync_integration_tickets

        org = request.user.profile.organization
        account = IntegrationAccount.objects.filter(
            pk=account_id, integration_id=integration_id, organization=org
        ).first()

        if not account:
            return Response(status=status.HTTP_404_NOT_FOUND)

        sync_integration_tickets.apply_async(args=[account_id], queue="ingestion")
        return Response({"detail": "Sync triggered.", "account_id": account_id})
