"""
Application configuration loaded from environment variables.
Uses pydantic-settings for validation and type coercion.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve the .env file relative to the project root (one level up from pipelineIQ/)
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Centralised, validated application settings."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # GitHub OAuth
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/auth/github/callback"

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "pipelineiq"

    # JWT / Sessions
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    SESSION_EXPIRY_DAYS: int = 15

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Cookie
    COOKIE_DOMAIN: str = "localhost"
    COOKIE_SECURE: bool = False


# Singleton — imported everywhere as `from config import settings`
settings = Settings()
