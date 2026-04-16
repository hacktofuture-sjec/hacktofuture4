from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent / ".env", override=False)


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _as_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    db_path: str
    environment: str
    prometheus_url: str
    loki_url: str
    tempo_url: str
    kubeconfig: str
    openai_api_key: str
    llm_model_primary: str
    llm_model_fallback: str
    budget_cap_per_incident: float
    budget_cap_per_run: float
    rule_confidence_threshold: float
    max_ai_calls_per_incident: int
    verification_window_seconds: int
    log_query_window_minutes: int
    log_top_signatures: int
    trace_latency_delta_threshold: float
    monitor_poll_interval_seconds: int
    force_ai_fallback: bool
    vcluster_namespace: str
    sandbox_validate_window_seconds: int
    max_retries_remediation: int
    cors_origins: str
    host: str
    port: int


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "t3ps2-backend"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
        db_path=os.getenv("DB_PATH", "data/t3ps2.db"),
        environment=os.getenv("ENVIRONMENT", "development"),
        prometheus_url=os.getenv("PROMETHEUS_URL", "http://localhost:9090"),
        loki_url=os.getenv("LOKI_URL", "http://localhost:3100"),
        tempo_url=os.getenv("TEMPO_URL", "http://localhost:3200"),
        kubeconfig=os.getenv("KUBECONFIG", os.path.expanduser("~/.kube/config")),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        llm_model_primary=os.getenv("LLM_MODEL_PRIMARY", "gpt-4o-mini"),
        llm_model_fallback=os.getenv("LLM_MODEL_FALLBACK", "gpt-4o"),
        budget_cap_per_incident=_as_float(os.getenv("BUDGET_CAP_PER_INCIDENT"), 0.05),
        budget_cap_per_run=_as_float(os.getenv("BUDGET_CAP_PER_RUN"), 0.20),
        rule_confidence_threshold=_as_float(os.getenv("RULE_CONFIDENCE_THRESHOLD"), 0.75),
        max_ai_calls_per_incident=_as_int(os.getenv("MAX_AI_CALLS_PER_INCIDENT"), 2),
        verification_window_seconds=_as_int(os.getenv("VERIFICATION_WINDOW_SECONDS"), 120),
        log_query_window_minutes=_as_int(os.getenv("LOG_QUERY_WINDOW_MINUTES"), 10),
        log_top_signatures=_as_int(os.getenv("LOG_TOP_SIGNATURES"), 5),
        trace_latency_delta_threshold=_as_float(os.getenv("TRACE_LATENCY_DELTA_THRESHOLD"), 2.0),
        monitor_poll_interval_seconds=_as_int(os.getenv("MONITOR_POLL_INTERVAL_SECONDS"), 15),
        force_ai_fallback=_as_bool(os.getenv("FORCE_AI_FALLBACK"), False),
        vcluster_namespace=os.getenv("VCLUSTER_NAMESPACE", "vcluster-sandboxes"),
        sandbox_validate_window_seconds=_as_int(os.getenv("SANDBOX_VALIDATE_WINDOW_SECONDS"), 90),
        max_retries_remediation=_as_int(os.getenv("MAX_RETRIES_REMEDIATION"), 1),
        cors_origins=os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
        ),
        host=os.getenv("HOST", "0.0.0.0"),
        port=_as_int(os.getenv("PORT"), 8000),
    )


settings = get_settings()


def as_dict() -> dict[str, Any]:
    return settings.__dict__.copy()
