"""
FastAPI agent service — health endpoint tests.

Uses FastAPI's TestClient (synchronous) which is compatible with
both unittest discovery AND pytest collection.
"""

import unittest

from fastapi.testclient import TestClient

from src.main import app


class TestHealth(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint_returns_200(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

    def test_health_response_has_required_keys(self):
        response = self.client.get("/health")
        data = response.json()
        self.assertIn("service", data)
        self.assertIn("status", data)

    def test_health_service_is_ok(self):
        response = self.client.get("/health")
        data = response.json()
        self.assertEqual(data["service"], "ok")
        self.assertEqual(data["status"], "healthy")

    def test_health_reports_llm_state(self):
        """LLM key may or may not be configured in CI — just check key exists."""
        response = self.client.get("/health")
        data = response.json()
        self.assertIn("llm", data)
        self.assertIn(data["llm"], ["configured", "not_configured", "error"])

    def test_pipeline_run_endpoint_exists_and_accepts_post(self):
        """
        POST /pipeline/run with valid shape should return 422 (Unprocessable)
        rather than 404 — proving the route exists and is reachable.
        Missing/wrong fields should fail validation, not routing.
        """
        response = self.client.post("/pipeline/run", json={})
        # 422 = route found, Pydantic validation failed (expected — payload is empty)
        # 404 = route missing (should never happen)
        self.assertNotEqual(response.status_code, 404, "Route /pipeline/run must exist")
        self.assertIn(response.status_code, [200, 201, 400, 422])

    def test_pipeline_run_missing_body_returns_422(self):
        """Empty body → FastAPI Pydantic validation error → 422."""
        response = self.client.post("/pipeline/run", json={})
        self.assertEqual(response.status_code, 422)

    def test_docs_endpoint_accessible(self):
        """OpenAPI docs must be reachable."""
        response = self.client.get("/docs")
        self.assertEqual(response.status_code, 200)

    def test_openapi_json_accessible(self):
        """OpenAPI schema endpoint must be reachable."""
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("paths", data)
        self.assertIn("/health", data["paths"])
        self.assertIn("/pipeline/run", data["paths"])
