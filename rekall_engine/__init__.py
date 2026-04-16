"""
rekall_engine — public API surface.

This is the single module that feeds the FastAPI backend.
The backend only imports from here; internal structure is opaque.

Usage:
    from rekall_engine import run_pipeline, get_vault_store

    # In a FastAPI background task:
    async for update in run_pipeline(raw_webhook, incident_id):
        ...  # stream AgentLogEntry to SSE

    # Browse the vault:
    vault = get_vault_store()
    entries = vault.list_all()
"""

from .graph.orchestrator import run_pipeline          # noqa: F401
from .vault.store import VaultStore
from .config import engine_config                     # noqa: F401

_vault_store: VaultStore | None = None


def get_vault_store() -> VaultStore:
    """Return singleton VaultStore (lazy init)."""
    global _vault_store
    if _vault_store is None:
        _vault_store = VaultStore(vault_path=engine_config.vault_path)
    return _vault_store


