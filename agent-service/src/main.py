"""
FastAPI Agent Service — Product Intelligence Platform.

This service:
  - Runs the LangGraph AI pipeline (Mapper + Validator nodes)
  - NEVER writes to DB directly — all writes go via Django APIs
  - Communicates with Django via httpx (authenticated by X-API-Key)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.health import router as health_router
from .routers.pipeline import router as pipeline_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle manager."""
    logger.info("Agent service starting up...")
    yield
    logger.info("Agent service shutting down...")


app = FastAPI(
    title="Product Intelligence Platform — Agent Service",
    description=(
        "LangGraph-powered AI pipeline service. "
        "Normalizes raw webhook events into unified tickets via LLM + deterministic validation. "
        "All DB writes are proxied through Django REST APIs."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router)
app.include_router(pipeline_router)
