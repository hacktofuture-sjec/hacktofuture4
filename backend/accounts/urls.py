"""accounts URL configuration."""

from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path(
        "organizations/<uuid:id>/",
        views.OrganizationDetailView.as_view(),
        name="org-detail",
    ),
    path(
        "organizations/<uuid:org_id>/members/",
        views.OrganizationMemberListView.as_view(),
        name="org-member-list",
    ),
    path(
        "organizations/<uuid:org_id>/members/<int:pk>/",
        views.OrganizationMemberDetailView.as_view(),
        name="org-member-detail",
    ),
    path(
        "organizations/<uuid:org_id>/invites/",
        views.OrganizationInviteListView.as_view(),
        name="org-invite-list",
    ),
    path(
        "organizations/<uuid:org_id>/invites/<uuid:token>/accept/",
        views.AcceptInviteView.as_view(),
        name="invite-accept",
    ),
    path("roles/", views.RoleListView.as_view(), name="role-list"),
]
