from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    prometheus_url: str = Field(default="http://localhost:9090", alias="PROMETHEUS_URL")
    loki_url: str = Field(default="http://localhost:3100", alias="LOKI_URL")
    tempo_url: str = Field(default="http://localhost:3200", alias="TEMPO_URL")
    kubeconfig: str = Field(default="~/.kube/config", alias="KUBECONFIG")
    db_path: str = Field(default="data/t3ps2.db", alias="DB_PATH")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    llm_model_primary: str = Field(default="gpt-4o-mini", alias="LLM_MODEL_PRIMARY")
    llm_model_fallback: str = Field(default="gpt-4o", alias="LLM_MODEL_FALLBACK")

    budget_cap_per_incident_usd: float = Field(default=0.05, alias="BUDGET_CAP_PER_INCIDENT")
    budget_cap_per_run_usd: float = Field(default=0.20, alias="BUDGET_CAP_PER_RUN")
    rule_confidence_threshold: float = Field(default=0.75, alias="RULE_CONFIDENCE_THRESHOLD")
    max_ai_calls_per_incident: int = Field(default=2, alias="MAX_AI_CALLS_PER_INCIDENT")
    verification_window_seconds: int = Field(default=120, alias="VERIFICATION_WINDOW_SECONDS")
    log_query_window_minutes: int = Field(default=10, alias="LOG_QUERY_WINDOW_MINUTES")
    log_top_signatures: int = Field(default=5, alias="LOG_TOP_SIGNATURES")
    trace_latency_threshold_x: float = Field(default=2.0, alias="TRACE_LATENCY_DELTA_THRESHOLD")
    monitor_poll_interval_seconds: int = Field(default=15, alias="MONITOR_POLL_INTERVAL_SECONDS")

    force_ai_fallback: bool = Field(default=False, alias="FORCE_AI_FALLBACK")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
