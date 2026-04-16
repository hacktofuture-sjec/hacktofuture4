"""
REKALL — Flat-File VaultStore

Replaces PostgreSQL + ChromaDB with simple JSON files on disk.
Each vault entry is stored as `vault/{scope}/{sanitized_signature}.json`.

Thread-safe reads (Go reads simultaneously, Python writes atomically).
Atomic writes: write to `.tmp` then `os.replace()` — no partial corruption.

Usage:
    store = VaultStore("vault")
    entry = store.get_by_signature("infra:postgres:econnrefused")
    all_entries = store.list_all()
    store.upsert(entry_dict)
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import uuid
import fcntl
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger("rekall.vault")


def _sanitize_filename(sig: str) -> str:
    """Convert a failure signature to a safe filename (without .json extension)."""
    # Replace characters that are unsafe in filenames
    safe = re.sub(r"[/\\<>\"'|?*\s]+", "_", sig)
    return safe.strip("_")[:200]  # cap at 200 chars


class VaultStore:
    """
    Flat-file vault with local and org scopes.

    Directory layout:
        {vault_path}/
            local/
                infra:postgres:econnrefused.json
                oom:java:heapspace.json
            org/
                (shared entries, same format)
            episodes.json   ← RL episode log (array, append-only)
    """

    def __init__(self, vault_path: str = "vault") -> None:
        self._root = Path(vault_path)
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        (self._root / "local").mkdir(parents=True, exist_ok=True)
        (self._root / "org").mkdir(parents=True, exist_ok=True)

    def _scope_dir(self, scope: str = "local") -> Path:
        return self._root / scope

    def _entry_path(self, sig: str, scope: str = "local") -> Path:
        return self._scope_dir(scope) / f"{_sanitize_filename(sig)}.json"

    # ── Read operations ───────────────────────────────────────────────────────

    def get_by_signature(self, sig: str, scope: str = "local") -> Optional[Dict[str, Any]]:
        """Exact-match lookup by failure_signature."""
        path = self._entry_path(sig, scope)
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("[vault] failed to read %s: %s", path, exc)
            return None

    def search_by_type(self, failure_type: str, scope: str = "local") -> List[Dict[str, Any]]:
        """Return all entries matching the given failure_type, sorted by confidence DESC."""
        all_entries = self.list_all(scope)
        matching = [e for e in all_entries if e.get("failure_type") == failure_type]
        return sorted(matching, key=lambda e: e.get("confidence", 0), reverse=True)

    def list_all(self, scope: str = "local") -> List[Dict[str, Any]]:
        """Return all vault entries in the given scope, sorted by confidence DESC."""
        scope_dir = self._scope_dir(scope)
        entries: List[Dict[str, Any]] = []

        if not scope_dir.exists():
            return entries

        for path in scope_dir.glob("*.json"):
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
                entries.append(entry)
            except (json.JSONDecodeError, OSError) as exc:
                log.warning("[vault] skipping %s: %s", path, exc)

        return sorted(entries, key=lambda e: e.get("confidence", 0), reverse=True)

    # ── Write operations ──────────────────────────────────────────────────────

    def upsert(self, entry: Dict[str, Any], scope: str = "local") -> None:
        """
        Write or update a vault entry. Keyed on failure_signature.
        Uses atomic write (tmpfile + os.replace) to prevent corruption.
        """
        sig = entry.get("failure_signature", "")
        if not sig:
            log.warning("[vault] upsert failed: missing failure_signature")
            return

        # Set defaults
        entry.setdefault("id", str(uuid.uuid4()))
        entry.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        entry["updated_at"] = datetime.now(timezone.utc).isoformat()
        entry.setdefault("retrieval_count", 0)
        entry.setdefault("success_count", 0)
        entry.setdefault("reward_score", 0.0)
        entry.setdefault("confidence", 0.80)
        entry.setdefault("source", "synthetic")

        path = self._entry_path(sig, scope)
        self._atomic_write(path, entry)
        log.info("[vault] upserted %s in %s scope", sig, scope)

    def update_confidence(
        self,
        failure_signature: str,
        reward_delta: float,
        scope: str = "local",
        decay_days: float = 0.0,
    ) -> bool:
        """
        Apply a reward delta (+1.0 success / -1.0 failure) and optional
        temporal confidence decay (0.995 ^ days) to an existing vault entry.
        Returns True if the entry was found and updated, False otherwise.
        """
        entry = self.get_by_signature(failure_signature, scope)
        if entry is None:
            log.warning("[vault] update_confidence: no entry for sig=%r scope=%s", failure_signature, scope)
            return False

        # Apply reward delta to reward_score
        prev_reward = float(entry.get("reward_score", 0.0))
        entry["reward_score"] = prev_reward + reward_delta

        # Apply temporal decay to confidence
        prev_conf = float(entry.get("confidence", 0.80))
        if decay_days > 0:
            decay_factor = 0.995 ** decay_days
            entry["confidence"] = round(prev_conf * decay_factor, 6)

        # Bump counters
        entry["retrieval_count"] = int(entry.get("retrieval_count", 0)) + 1
        if reward_delta > 0:
            entry["success_count"] = int(entry.get("success_count", 0)) + 1

        self.upsert(entry, scope)
        log.info(
            "[vault] update_confidence sig=%r reward %.1f→%.1f conf %.3f→%.3f",
            failure_signature,
            prev_reward, entry["reward_score"],
            prev_conf, entry["confidence"],
        )
        return True

    def append_episode(self, episode: Dict[str, Any]) -> None:
        """
        Append an RL episode record to vault/episodes.json.
        The file is a JSON array (append-only log).
        Uses atomic write to prevent corruption.
        """
        import json as _json
        episodes_path = self._root / "episodes.json"
        
        # We need a dedicated lock file to prevent overlapping appends
        lock_path = self._root / ".episodes.lock"
        with open(lock_path, "w") as lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            try:
                # Read existing
                try:
                    existing: List[Dict[str, Any]] = _json.loads(
                        episodes_path.read_text(encoding="utf-8")
                    ) if episodes_path.exists() else []
                except (ValueError, OSError):
                    existing = []

                episode.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
                existing.append(episode)

                self._atomic_write(episodes_path, existing)
                log.debug("[vault] episode appended (total=%d)", len(existing))
            finally:
                fcntl.flock(lock_file, fcntl.LOCK_UN)


    # ── Stats ─────────────────────────────────────────────────────────────────

    def stats(self, scope: str = "local") -> Dict[str, Any]:
        """Compute aggregate stats for the vault."""
        entries = self.list_all(scope)
        human = [e for e in entries if e.get("source") == "human"]
        synthetic = [e for e in entries if e.get("source") == "synthetic"]
        confidences = [e.get("confidence", 0) for e in entries]

        return {
            "total": len(entries),
            "human_count": len(human),
            "synthetic_count": len(synthetic),
            "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else None,
        }

    # ── Atomic write helper ───────────────────────────────────────────────────

    def _atomic_write(self, path: Path, data: Any) -> None:
        """Write JSON data atomically using tmpfile + os.replace."""
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            os.replace(tmp_path, str(path))
        except Exception:
            # Clean up tmp file on failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
