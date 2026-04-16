"""
Comprehensive accounts API endpoint tests.
"""

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRegistration:
    def test_register_creates_user_org_profile(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "email": "new@example.com",
                "password": "SecurePass123!",
                "first_name": "Alice",
                "last_name": "Smith",
                "organization_name": "Alice Corp",
            },
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        data = resp.json()
        assert "access" in data
        assert "refresh" in data
        assert "user_id" in data
        assert "email" in data

    def test_duplicate_email_registration_fails(self, user_fixture, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "email": "test@example.com",
                "password": "SecurePass123!",
                "first_name": "Bob",
                "last_name": "Jones",
                "organization_name": "Bob Corp",
            },
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_fields_returns_400(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {"email": "incomplete@example.com"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_weak_password_fails(self, client):
        resp = client.post(
            "/api/v1/auth/register/",
            {
                "email": "weak@example.com",
                "password": "1234",
                "first_name": "Weak",
                "last_name": "Pass",
                "organization_name": "Weak Corp",
            },
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    def test_login_returns_jwt(self, user_fixture, client):
        resp = client.post(
            "/api/v1/auth/login/",
            {"username": "test@example.com", "password": "Securepass123!"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "access" in data
        assert "refresh" in data

    def test_login_wrong_password_fails(self, user_fixture, client):
        resp = client.post(
            "/api/v1/auth/login/",
            {"username": "test@example.com", "password": "wrongpassword"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_unknown_user_fails(self, client):
        resp = client.post(
            "/api/v1/auth/login/",
            {"username": "nobody@example.com", "password": "somepassword"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_returns_profile(self, auth_client):
        resp = auth_client.get("/api/v1/auth/me/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert "first_name" in data
        assert "organization_name" in data

    def test_me_unauthenticated_returns_401(self, client):
        resp = client.get("/api/v1/auth/me/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_patch_updates_profile(self, auth_client):
        resp = auth_client.patch(
            "/api/v1/auth/me/",
            {"timezone": "America/New_York"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_me_with_invalid_token_returns_401(self, client):
        from rest_framework.test import APIClient

        bad_client = APIClient()
        bad_client.credentials(HTTP_AUTHORIZATION="Bearer invalidtoken")
        resp = bad_client.get("/api/v1/auth/me/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestLogout:
    def test_logout_with_valid_refresh_token(self, user_fixture, client):
        """Logout is open — only the refresh token is needed, no access token."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user_fixture)
        resp = client.post(
            "/api/v1/auth/logout/",
            {"refresh": str(refresh)},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_logout_with_invalid_token_returns_400(self, client):
        resp = client.post(
            "/api/v1/auth/logout/",
            {"refresh": "not-a-real-token"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
