"""
FastAPI Agent Service settings (Pydantic BaseSettings).
All values loaded from environment variables.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.0

    # Django backend
    django_api_base_url: str = "http://localhost:8000"
    django_api_key: str = ""  # X-API-Key for service-to-service calls

    # Service
    service_host: str = "0.0.0.0"
    service_port: int = 8001
    debug: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
