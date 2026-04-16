"""
REKALL Engine — configuration.

Reads from environment variables (or a .env file via pydantic-settings).
All fields have safe defaults so the engine starts without any env vars set.
"""

from __future__ import annotations

import os

# ── Try pydantic-settings first; fall back to stdlib os.getenv ────────────────
try:
    from pydantic_settings import BaseSettings

    class EngineConfig(BaseSettings):
        # ── LLM ─────────────────────────────────────────────────────────────
        groq_api_key: str = ""
        # Free-tier Groq models (no billing required):
        #   Root agent  → llama-3.3-70b-versatile  (6000 TPM / 30 RPM free)
        #   Sub-agents  → llama-3.1-8b-instant      (20000 TPM / 30 RPM free)
        rlm_model:        str = "llama-3.3-70b-versatile"   # root RLM agent
        rlm_subagent_model: str = "llama-3.1-8b-instant"    # sub-agents (faster, cheaper)
        # groq_model kept for back-compat
        groq_model:       str = "llama-3.3-70b-versatile"

        # ── Vault ─────────────────────────────────────────────────────────
        vault_path: str = "vault"
        org_vault_enabled: bool = False

        # ── Vault similarity / reward thresholds ──────────────────────────
        tier1_similarity_threshold: float = 0.85
        tier2_similarity_threshold: float = 0.75
        tier1_reward_threshold:     float = 0.70
        tier2_reward_threshold:     float = 0.50
        ranker_skip_threshold:      float = -2.00
        reward_step_size:           float = 1.0

        # ── Governance risk thresholds ────────────────────────────────────
        auto_apply_max_risk: float = 0.30
        create_pr_max_risk:  float = 0.70

        # ── RLM REPL Engine ───────────────────────────────────────────────
        rlm_max_log_chars:      int = 120_000
        rlm_max_depth:          int = 3
        rlm_max_steps:          int = 10
        rlm_output_truncation:  int = 20_000
        simulation_enabled:     bool = False

        # ── Integrations ──────────────────────────────────────────────────
        integrations_enabled:   bool = True
        slack_webhook_url:      str = ""
        notion_token:           str = ""
        notion_database_id:     str = ""

        # ── GitHub Live PR (production only) ─────────────────────────────
        # When github_live_pr=True the orchestrator execute step uses PyGithub
        # to branch, commit fix_commands, and call repo.create_pull().
        # Keep False in demo mode — the pipeline emits trace events only.
        github_token:    str  = ""     # GITHUB_TOKEN env var (fine-grained PAT)
        github_repo:     str  = ""     # e.g. "owner/repo" (GITHUB_REPO)
        github_live_pr:  bool = False  # set True to enable real PR creation

        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            extra = "ignore"

    engine_config = EngineConfig()

except ImportError:
    # ── stdlib fallback — no pydantic dep required for basic operation ────────
    class _FallbackConfig:  # type: ignore[no-redef]
        groq_api_key            = os.getenv("GROQ_API_KEY", "")
        rlm_model               = os.getenv("RLM_MODEL", "llama-3.3-70b-versatile")
        groq_model              = os.getenv("RLM_MODEL", "llama-3.3-70b-versatile")
        vault_path              = os.getenv("VAULT_PATH", "vault")
        org_vault_enabled       = os.getenv("ORG_VAULT_ENABLED", "false").lower() == "true"
        tier1_similarity_threshold = float(os.getenv("TIER1_SIM_THRESHOLD", "0.85"))
        tier2_similarity_threshold = float(os.getenv("TIER2_SIM_THRESHOLD", "0.75"))
        tier1_reward_threshold     = float(os.getenv("TIER1_REWARD_THRESHOLD", "0.70"))
        tier2_reward_threshold     = float(os.getenv("TIER2_REWARD_THRESHOLD", "0.50"))
        ranker_skip_threshold      = float(os.getenv("RANKER_SKIP_THRESHOLD", "-2.0"))
        reward_step_size           = float(os.getenv("REWARD_STEP_SIZE", "1.0"))
        auto_apply_max_risk        = float(os.getenv("AUTO_APPLY_MAX_RISK", "0.30"))
        create_pr_max_risk         = float(os.getenv("CREATE_PR_MAX_RISK", "0.70"))
        rlm_max_log_chars          = int(os.getenv("RLM_MAX_LOG_CHARS", "120000"))
        rlm_max_depth              = int(os.getenv("RLM_MAX_DEPTH", "3"))
        rlm_max_steps              = int(os.getenv("RLM_MAX_STEPS", "10"))
        rlm_output_truncation      = int(os.getenv("RLM_OUTPUT_TRUNCATION", "20000"))
        simulation_enabled         = os.getenv("SIMULATION_ENABLED", "false").lower() == "true"
        integrations_enabled       = os.getenv("INTEGRATIONS_ENABLED", "true").lower() == "true"
        slack_webhook_url          = os.getenv("SLACK_WEBHOOK_URL", "")
        notion_token               = os.getenv("NOTION_TOKEN", "")
        notion_database_id         = os.getenv("NOTION_DATABASE_ID", "")
        github_token               = os.getenv("GITHUB_TOKEN", "")
        github_repo                = os.getenv("GITHUB_REPO", "")
        github_live_pr             = os.getenv("GITHUB_LIVE_PR", "false").lower() == "true"

    engine_config = _FallbackConfig()


# Convenience alias used across the codebase
def get_config() -> EngineConfig:  # type: ignore[return-value]
    return engine_config


# Also expose Settings as an alias for code that does `from config import Settings()`
Settings = EngineConfig if "EngineConfig" in dir() else type(engine_config)
