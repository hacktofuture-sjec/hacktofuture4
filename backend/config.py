import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "PipeGenie"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "pipegenie-super-secret-key-change-in-prod"

    # MongoDB
    MONGODB_URL: str #= "mongodb://localhost:27017"
    MONGODB_DB: str = "pipegenie"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_TTL: int = 3600  # 1 hour cache

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_WEBHOOK_SECRET: str = "pipegenie-webhook-secret"
    REPO_WRITEBACK_ENABLED: bool = True
    AUTO_OPEN_PR: bool = True
    PIPEGENIE_BOT_NAME: str = "PipeGenie Bot"
    PIPEGENIE_BOT_EMAIL: str = "pipegenie-bot@users.noreply.github.com"

    # AI / LLM provider
    LLM_PROVIDER: str = "gemini"      # gemini (default) | ollama | mistral
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Legacy/manual options (kept for compatibility)
    MISTRAL_API_KEY: str = ""          # Manual fallback provider
    MISTRAL_MODEL: str = "mistral-large-latest"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    USE_OLLAMA: bool = False            # Legacy switch; prefer LLM_PROVIDER
    LLM_MODEL: str = "mistral"         # Ollama model name when LLM_PROVIDER=ollama

    # MilvusDB
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530

    # Docker
    DOCKER_NETWORK: str = "pipegenie-net"

    # Risk thresholds
    RISK_LOW_THRESHOLD: float = 0.3
    RISK_HIGH_THRESHOLD: float = 0.7

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Observability (SigNoz / OpenTelemetry)
    OTEL_ENABLED: bool = True
    OTEL_SERVICE_NAME: str = "pipegenie-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://127.0.0.1:4318/v1/traces"
    OTEL_EXPORTER_OTLP_INSECURE: bool = True
    OTEL_RESOURCE_ATTRIBUTES: str = "service.namespace=pipegenie,deployment.environment=dev"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
