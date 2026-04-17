"""Processing URL conf."""

from django.urls import path

from . import views

app_name = "processing"

urlpatterns = [
    path("processing/runs/", views.ProcessingRunListView.as_view(), name="run-list"),
    path(
        "processing/runs/<uuid:pk>/",
        views.ProcessingRunDetailView.as_view(),
        name="run-detail",
    ),
    path(
        "processing/runs/<uuid:run_id>/steps/",
        views.ProcessingStepLogListView.as_view(),
        name="run-steps",
    ),
]
