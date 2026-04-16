"""
Accounts views — auth endpoints, org management, RBAC.
"""

import logging

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Organization, OrganizationInvite, OrganizationMember, Role
from .serializers import (
    CustomTokenObtainPairSerializer,
    OrganizationInviteSerializer,
    OrganizationMemberSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
    RoleSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterView(APIView):
    """POST /api/v1/auth/register/ — creates User + Org atomically."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        logger.info("New user registered: %s", user.email)
        return Response(
            {
                "user_id": user.id,
                "email": user.email,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns JWT pair with user/org context."""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklists refresh token."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."})
        except Exception as exc:
            return Response(
                {"error": "invalid_token", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/ — current user profile."""

    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user.profile


class OrganizationDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/organizations/{id}/"""

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return OrganizationUpdateSerializer
        return OrganizationSerializer

    def get_queryset(self):
        return Organization.objects.filter(
            members__user=self.request.user, members__is_active=True
        )


class OrganizationMemberListView(generics.ListCreateAPIView):
    """GET/POST /api/v1/organizations/{org_id}/members/"""

    serializer_class = OrganizationMemberSerializer

    def get_queryset(self):
        return OrganizationMember.objects.filter(
            organization_id=self.kwargs["org_id"]
        ).select_related("user", "role")


class OrganizationMemberDetailView(generics.DestroyAPIView):
    """DELETE /api/v1/organizations/{org_id}/members/{user_id}/"""

    def get_queryset(self):
        return OrganizationMember.objects.filter(organization_id=self.kwargs["org_id"])


class OrganizationInviteListView(generics.ListCreateAPIView):
    """GET/POST /api/v1/organizations/{org_id}/invites/"""

    serializer_class = OrganizationInviteSerializer

    def get_queryset(self):
        return OrganizationInvite.objects.filter(organization_id=self.kwargs["org_id"])

    def perform_create(self, serializer):
        from datetime import timedelta

        serializer.save(
            organization_id=self.kwargs["org_id"],
            invited_by=self.request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )


class AcceptInviteView(APIView):
    """POST /api/v1/organizations/{org_id}/invites/{token}/accept/"""

    permission_classes = [permissions.AllowAny]

    def post(self, request, org_id, token):
        try:
            invite = OrganizationInvite.objects.get(
                token=token, organization_id=org_id, status="pending"
            )
        except OrganizationInvite.DoesNotExist:
            return Response(
                {"error": "not_found", "detail": "Invite not found or already used."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.expires_at < timezone.now():
            invite.status = "expired"
            invite.save(update_fields=["status"])
            return Response(
                {"error": "expired", "detail": "Invite has expired."},
                status=status.HTTP_410_GONE,
            )

        if not request.user.is_authenticated:
            return Response(
                {"detail": "Login required to accept invite."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        OrganizationMember.objects.get_or_create(
            organization=invite.organization,
            user=request.user,
            defaults={"role": invite.role},
        )
        invite.status = "accepted"
        invite.save(update_fields=["status"])
        return Response({"detail": "Invite accepted."})


class RoleListView(generics.ListAPIView):
    """GET /api/v1/roles/ — list roles for org."""

    serializer_class = RoleSerializer

    def get_queryset(self):
        org_id = self.request.user.profile.organization_id
        return Role.objects.filter(Q(organization_id=org_id) | Q(is_system=True))
