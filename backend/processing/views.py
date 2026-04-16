"""Processing views."""

from rest_framework import generics

from .models import ProcessingRun, ProcessingStepLog
from .serializers import ProcessingRunSerializer, ProcessingStepLogSerializer


class ProcessingRunListView(generics.ListAPIView):
    serializer_class = ProcessingRunSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ProcessingRun.objects.filter(organization=org).prefetch_related(
            "step_logs"
        ).order_by("-started_at")


class ProcessingRunDetailView(generics.RetrieveAPIView):
    serializer_class = ProcessingRunSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ProcessingRun.objects.filter(organization=org)


class ProcessingStepLogListView(generics.ListAPIView):
    serializer_class = ProcessingStepLogSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return ProcessingStepLog.objects.filter(
            processing_run_id=self.kwargs["run_id"],
            processing_run__organization=org,
        ).order_by("sequence")
