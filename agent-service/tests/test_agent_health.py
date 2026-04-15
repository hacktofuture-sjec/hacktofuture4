import unittest
from fastapi.testclient import TestClient
from src.main import app


class TestHealth(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "agent"})

    def test_query_endpoint(self):
        # Stub test to check if endpoint exists
        response = self.client.post("/query", json={"query": "test"})
        # The main.py will return SSE stream or basic response for now.
        # Just check status code is success
        self.assertEqual(response.status_code, 200)
