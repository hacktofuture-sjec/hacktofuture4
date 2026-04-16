"""
Reusable DRF permission classes used across all platform apps.
"""

from rest_framework.permissions import BasePermission

from security.models import ApiKey


class IsOrganizationMember(BasePermission):
    """Allow access only to authenticated users who belong to the target org."""

    message = "You are not a member of this organization."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        org = getattr(obj, "organization", None)
        if org is None:
            return True
        return request.user.org_memberships.filter(
            organization=org, is_active=True
        ).exists()


class IsOrganizationAdmin(BasePermission):
    """Allow access only to org members with admin or owner role."""

    message = "You must be an admin of this organization."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        org = getattr(obj, "organization", None)
        if org is None:
            return True
        return request.user.org_memberships.filter(
            organization=org,
            is_active=True,
            role__name__in=["owner", "admin"],
        ).exists()


class HasApiKey(BasePermission):
    """
    Service-to-service auth via X-API-Key header.
    Used by FastAPI agent service to call Django internal endpoints.
    """

    message = "Valid API key required."

    def has_permission(self, request, view):
        raw_key = request.META.get("HTTP_X_API_KEY", "")
        if not raw_key:
            return False
        import hashlib

        hashed = hashlib.sha256(raw_key.encode()).hexdigest()
        key = ApiKey.objects.filter(
            hashed_key=hashed, is_active=True
        ).select_related("organization").first()
        if not key:
            return False
        # Check expiry
        from django.utils import timezone

        if key.expires_at and key.expires_at < timezone.now():
            return False
        # Attach org to request for downstream filtering
        request.api_key = key
        request.org = key.organization
        ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        return True
