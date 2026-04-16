import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    db_path: str
    environment: str


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "t3ps2-backend"),
        app_version=os.getenv("APP_VERSION", "0.1.0"),
        db_path=os.getenv("DB_PATH", "./backend/data/t3ps2.db"),
        environment=os.getenv("ENVIRONMENT", "development"),
    )
