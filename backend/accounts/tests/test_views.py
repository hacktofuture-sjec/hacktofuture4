"""
Accounts API endpoint tests.
"""

import pytest
from django.urls import reverse
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


@pytest.mark.django_db
class TestLogin:
    def test_login_returns_jwt(self, user_fixture, client):
        resp = client.post(
            "/api/v1/auth/login/",
            {"username": "test@example.com", "password": "Securepass123!"},
            content_type="application/json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.json()


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_returns_profile(self, auth_client):
        resp = auth_client.get("/api/v1/auth/me/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()["email"] == "test@example.com"

    def test_me_unauthenticated_returns_401(self, client):
        resp = client.get("/api/v1/auth/me/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED
