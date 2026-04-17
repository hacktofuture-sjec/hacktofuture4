"""Insights URL conf."""

from django.urls import path

from . import views

app_name = "insights"

urlpatterns = [
    path("insights/", views.InsightListView.as_view(), name="insight-list"),
    path("dashboards/", views.DashboardListView.as_view(), name="dashboard-list"),
    path(
        "dashboards/<int:pk>/",
        views.DashboardDetailView.as_view(),
        name="dashboard-detail",
    ),
    path(
        "dashboards/<int:dashboard_id>/widgets/",
        views.DashboardWidgetListView.as_view(),
        name="widget-list",
    ),
    path("saved-queries/", views.SavedQueryListView.as_view(), name="saved-query-list"),
]
