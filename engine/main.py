from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings


# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

class Settings(BaseSettings):
    groq_api_key: str = ""
    chromadb_host: str = "localhost"
    chromadb_port: int = 8001
    go_backend_url: str = "http://localhost:8000"   # callback target
    log_level: str = "INFO"

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("rekall.engine")
