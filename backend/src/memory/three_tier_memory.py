from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class MemoryDocument:
    title: str
    path: str
    source_type: str
    content: str


class ThreeTierMemory:
    def __init__(self) -> None:
        self.index_layer = "MEMORY.MD"
        self.docs_layer = "markdown"
        self.transcript_layer = "json"
        self.repo_root = Path(__file__).resolve().parents[3]
        self.data_root = self.repo_root / "data"
        self.transcript_root = self.repo_root / "backend" / ".uniops" / "transcripts"
        self.transcript_root.mkdir(parents=True, exist_ok=True)
        self._documents_cache: list[MemoryDocument] | None = None

    def summary(self) -> dict[str, Any]:
        documents = self.load_documents()
        return {
            "index": self.index_layer,
            "documents": self.docs_layer,
            "transcripts": self.transcript_layer,
            "document_count": len(documents),
        }

    def load_documents(self, force_reload: bool = False) -> list[MemoryDocument]:
        if self._documents_cache is not None and not force_reload:
            return self._documents_cache

        collected: list[MemoryDocument] = []
        source_dirs = ["confluence", "runbooks", "incidents", "github", "slack"]
        for source_dir in source_dirs:
            folder = self.data_root / source_dir
            if not folder.exists():
                continue

            for file_path in folder.glob("**/*"):
                if file_path.is_dir() or file_path.suffix.lower() not in {".md", ".json"}:
                    continue

                try:
                    content = file_path.read_text(encoding="utf-8")
                except OSError:
                    continue

                rel_path = file_path.relative_to(self.repo_root).as_posix()
                collected.append(
                    MemoryDocument(
                        title=file_path.stem.replace("-", " ").title(),
                        path=rel_path,
                        source_type=source_dir,
                        content=content,
                    )
                )

        self._documents_cache = collected
        return collected

    def persist_transcript(self, trace_id: str, steps: list[dict[str, Any]]) -> None:
        target = self.transcript_root / f"{trace_id}.json"
        payload = {
            "trace_id": trace_id,
            "steps": steps,
        }
        target.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def get_transcript(self, trace_id: str) -> dict[str, Any] | None:
        target = self.transcript_root / f"{trace_id}.json"
        if not target.exists():
            return None
        try:
            return json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
