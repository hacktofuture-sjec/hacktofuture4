"""
Pytest configuration and shared fixtures for engine service tests.
"""

import sys
import os
import pytest
from httpx import AsyncClient, ASGITransport

# Make rekall_engine importable from the project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

# Set required env vars before importing the app
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ.setdefault("GO_BACKEND_URL", "http://localhost:8000")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Async HTTPX client wired directly to the FastAPI app (no network)."""
    from engine.main import app  # noqa: PLC0415
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
