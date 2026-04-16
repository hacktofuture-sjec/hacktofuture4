"""Health check router."""

from fastapi import APIRouter
import httpx
from ..config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Service health with dependency checks."""
    checks = {"service": "ok", "status": "healthy"}

    # Check LLM connectivity
    try:
        if settings.openai_api_key:
            checks["llm"] = "configured"
        else:
            checks["llm"] = "not_configured"
    except Exception:
        checks["llm"] = "error"

    # Check Django connectivity
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.django_api_base_url}/health")
            checks["django"] = "ok" if resp.status_code == 200 else "degraded"
    except Exception:
        checks["django"] = "unreachable"

    return checks
