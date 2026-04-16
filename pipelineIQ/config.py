from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/auth/github/callback"
    GITHUB_OAUTH_SCOPES: str = "read:user read:org"

    GITHUB_APP_ID: str
    GITHUB_APP_SLUG: str
    GITHUB_APP_PRIVATE_KEY: str
    GITHUB_APP_WEBHOOK_SECRET: str
    GITHUB_APP_INSTALL_URL: str | None = None

    MONGODB_URI: str
    MONGODB_DB_NAME: str = "pipelineiq"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    SESSION_EXPIRY_DAYS: int = 15

    FRONTEND_URL: str = "http://localhost:5173"

    COOKIE_DOMAIN: str | None = None
    COOKIE_SECURE: bool = False

    @property
    def github_app_install_url(self) -> str:
        return self.GITHUB_APP_INSTALL_URL or (
            f"https://github.com/apps/{self.GITHUB_APP_SLUG}/installations/new"
        )

    @property
    def github_app_private_key_pem(self) -> str:
        return self.GITHUB_APP_PRIVATE_KEY.replace("\\n", "\n")


settings = Settings()
