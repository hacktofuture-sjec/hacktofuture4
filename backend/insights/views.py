"""Insights views."""

from rest_framework import generics

from .models import Dashboard, DashboardWidget, Insight, SavedQuery
from .serializers import (
    DashboardSerializer,
    DashboardWidgetSerializer,
    InsightSerializer,
    SavedQuerySerializer,
)


class InsightListView(generics.ListAPIView):
    serializer_class = InsightSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return Insight.objects.filter(organization=org).order_by("-created_at")


class DashboardListView(generics.ListCreateAPIView):
    serializer_class = DashboardSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return (
            Dashboard.objects.filter(organization=org)
            .prefetch_related("widgets")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        serializer.save(organization=org, created_by=self.request.user)


class DashboardDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DashboardSerializer

    def get_queryset(self):
        return Dashboard.objects.filter(
            organization=self.request.user.profile.organization
        )


class DashboardWidgetListView(generics.ListCreateAPIView):
    serializer_class = DashboardWidgetSerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return DashboardWidget.objects.filter(
            dashboard_id=self.kwargs["dashboard_id"],
            dashboard__organization=org,
        )

    def perform_create(self, serializer):
        serializer.save(dashboard_id=self.kwargs["dashboard_id"])


class SavedQueryListView(generics.ListCreateAPIView):
    serializer_class = SavedQuerySerializer

    def get_queryset(self):
        org = self.request.user.profile.organization
        return SavedQuery.objects.filter(organization=org).order_by("-created_at")

    def perform_create(self, serializer):
        org = self.request.user.profile.organization
        serializer.save(organization=org, created_by=self.request.user)
