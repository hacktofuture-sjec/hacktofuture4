"""Sync URL conf + views (minimal — internal use only)."""

from django.urls import path
from rest_framework import generics, serializers

from .models import SyncCheckpoint


class SyncCheckpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncCheckpoint
        fields = [
            "id",
            "integration_account",
            "checkpoint_key",
            "checkpoint_value",
            "last_synced_at",
            "records_synced",
        ]


class SyncCheckpointListView(generics.ListAPIView):
    serializer_class = SyncCheckpointSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return SyncCheckpoint.objects.filter(organization=org).order_by(
            "-last_synced_at"
        )


urlpatterns_sync = [
    path("sync/checkpoints/", SyncCheckpointListView.as_view(), name="checkpoint-list"),
]
