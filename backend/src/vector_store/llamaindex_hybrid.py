from __future__ import annotations

import hashlib
import os
from typing import Any

from llama_index.core.base.embeddings.base import BaseEmbedding


class DeterministicHashEmbedding(BaseEmbedding):
    """Local embedding model that deterministically maps text to normalized vectors."""

    embed_dim: int

    def __init__(self, embed_dim: int = 768, **kwargs: Any) -> None:
        super().__init__(embed_dim=embed_dim, **kwargs)

    @classmethod
    def class_name(cls) -> str:
        return "DeterministicHashEmbedding"

    def _vector_from_text(self, text: str) -> list[float]:
        seed = hashlib.sha256(text.encode("utf-8")).digest()
        values: list[float] = []
        counter = 0

        while len(values) < self.embed_dim:
            block = hashlib.sha256(seed + counter.to_bytes(4, "little")).digest()
            counter += 1
            for idx in range(0, len(block), 4):
                chunk = block[idx : idx + 4]
                if len(chunk) < 4:
                    continue
                raw = int.from_bytes(chunk, "little")
                values.append((raw / 4294967295.0) * 2.0 - 1.0)
                if len(values) >= self.embed_dim:
                    break

        norm = sum(value * value for value in values) ** 0.5
        if norm == 0.0:
            return values
        return [value / norm for value in values]

    async def _aget_query_embedding(self, query: str) -> list[float]:
        return self._vector_from_text(query)

    async def _aget_text_embedding(self, text: str) -> list[float]:
        return self._vector_from_text(text)

    def _get_query_embedding(self, query: str) -> list[float]:
        return self._vector_from_text(query)

    def _get_text_embedding(self, text: str) -> list[float]:
        return self._vector_from_text(text)


class LlamaIndexHybridService:
    """Provides semantic retrieval through LlamaIndex + Milvus with keyword fallback."""

    def __init__(self, mode: str | None = None) -> None:
        self.mode = (mode or os.getenv("RETRIEVAL_MODE", "keyword")).strip().lower()
        self.collection_name = os.getenv("MILVUS_COLLECTION_NAME", "uniops_documents")
        self.milvus_host = os.getenv("MILVUS_HOST", "127.0.0.1")
        self.milvus_port = int(os.getenv("MILVUS_PORT", "19530"))
        self.embedding_provider = os.getenv("EMBEDDING_PROVIDER", "deterministic").strip().lower()
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5").strip()
        self._index: Any | None = None
        self._indexed_signature: str | None = None
        self._index_doc_count = 0
        self._last_error: str | None = None
        self._active_embedding_provider: str | None = None

    def _normalize_documents(self, source_documents: list[Any]) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in source_documents:
            title = str(getattr(item, "title", "") or (item.get("title", "") if isinstance(item, dict) else "")).strip()
            path = str(getattr(item, "path", "") or (item.get("path", "") if isinstance(item, dict) else "")).strip()
            source_type = str(
                getattr(item, "source_type", "") or (item.get("source_type", "") if isinstance(item, dict) else "")
            ).strip()
            content = str(
                getattr(item, "content", "")
                or (item.get("content", "") if isinstance(item, dict) else "")
                or (item.get("snippet", "") if isinstance(item, dict) else "")
            ).strip()
            if not content:
                continue
            doc_key = path or title or hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
            if doc_key in seen:
                continue
            seen.add(doc_key)
            normalized.append(
                {
                    "title": title or "Untitled",
                    "path": path or f"runtime://{doc_key}",
                    "source_type": source_type or "unknown",
                    "content": content,
                }
            )
        return normalized

    def _documents_signature(self, source_documents: list[dict[str, str]]) -> str:
        h = hashlib.sha256()
        for doc in sorted(source_documents, key=lambda entry: entry["path"]):
            h.update(doc["path"].encode("utf-8"))
            h.update(b"\n")
            h.update(doc["content"].encode("utf-8"))
            h.update(b"\n")
        return h.hexdigest()

    def _resolve_embedding_model(self) -> tuple[Any | None, str, str | None]:
        provider = self.embedding_provider
        if provider in {"huggingface", "hf"}:
            try:
                from llama_index.embeddings.huggingface import HuggingFaceEmbedding

                return HuggingFaceEmbedding(model_name=self.embedding_model), "huggingface", None
            except Exception as exc:
                return None, "huggingface", f"HuggingFace embedding unavailable: {exc}"

        if provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY", "").strip()
            if not api_key:
                return None, "openai", "OPENAI_API_KEY is not configured for EMBEDDING_PROVIDER=openai"
            try:
                from llama_index.embeddings.openai import OpenAIEmbedding

                model_name = self.embedding_model or "text-embedding-3-small"
                return OpenAIEmbedding(api_key=api_key, model=model_name), "openai", None
            except Exception as exc:
                return None, "openai", f"OpenAI embedding unavailable: {exc}"

        if provider in {"deterministic", "local", "hash"}:
            return DeterministicHashEmbedding(embed_dim=768), "deterministic", None

        return None, provider, (
            "Unsupported EMBEDDING_PROVIDER. Use one of: deterministic, huggingface, openai"
        )

    def sync_documents(self, source_documents: list[Any]) -> dict[str, Any]:
        """Indexes documents in Milvus when semantic/hybrid retrieval is enabled."""
        if self.mode == "keyword":
            return {
                "indexed": False,
                "mode": self.mode,
                "reason": "semantic indexing skipped because RETRIEVAL_MODE=keyword",
                "collection": self.collection_name,
            }

        normalized_documents = self._normalize_documents(source_documents)
        if not normalized_documents:
            return {
                "indexed": False,
                "mode": self.mode,
                "reason": "no indexable documents were provided",
                "collection": self.collection_name,
            }

        signature = self._documents_signature(normalized_documents)
        if signature == self._indexed_signature and self._index is not None:
            return {
                "indexed": True,
                "mode": self.mode,
                "reused": True,
                "doc_count": self._index_doc_count,
                "collection": self.collection_name,
                "embedding_provider": self._active_embedding_provider,
            }

        try:
            from llama_index.core import Document, StorageContext, VectorStoreIndex
            from llama_index.vector_stores.milvus import MilvusVectorStore
        except Exception as exc:
            self._last_error = f"LlamaIndex Milvus dependencies unavailable: {exc}"
            return {
                "indexed": False,
                "mode": self.mode,
                "collection": self.collection_name,
                "reason": self._last_error,
            }

        embed_model, provider_used, embed_error = self._resolve_embedding_model()
        if embed_model is None:
            self._last_error = embed_error or "No embedding model available"
            return {
                "indexed": False,
                "mode": self.mode,
                "collection": self.collection_name,
                "reason": self._last_error,
            }

        try:
            vector_store = MilvusVectorStore(
                uri=f"http://{self.milvus_host}:{self.milvus_port}",
                collection_name=self.collection_name,
                dim=768,
                overwrite=True,
            )
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            llama_documents = [
                Document(
                    text=doc["content"],
                    metadata={
                        "title": doc["title"],
                        "path": doc["path"],
                        "source_type": doc["source_type"],
                    },
                )
                for doc in normalized_documents
            ]
            self._index = VectorStoreIndex.from_documents(
                llama_documents,
                storage_context=storage_context,
                embed_model=embed_model,
                show_progress=False,
            )
            self._indexed_signature = signature
            self._index_doc_count = len(normalized_documents)
            self._last_error = None
            self._active_embedding_provider = provider_used
            return {
                "indexed": True,
                "mode": self.mode,
                "reused": False,
                "doc_count": self._index_doc_count,
                "collection": self.collection_name,
                "embedding_provider": provider_used,
            }
        except Exception as exc:
            self._index = None
            self._indexed_signature = None
            self._index_doc_count = 0
            self._last_error = f"Milvus indexing failed: {exc}"
            return {
                "indexed": False,
                "mode": self.mode,
                "collection": self.collection_name,
                "reason": self._last_error,
            }

    def health(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "collection": self.collection_name,
            "milvus_host": self.milvus_host,
            "milvus_port": self.milvus_port,
            "embedding_provider": self._active_embedding_provider or self.embedding_provider,
            "indexed": self._index is not None,
            "doc_count": self._index_doc_count,
            "last_error": self._last_error,
        }

    def _semantic_retrieve(self, query: str, max_sources: int) -> list[dict[str, Any]]:
        if self._index is None:
            return []

        try:
            retriever = self._index.as_retriever(similarity_top_k=max_sources)
            nodes = retriever.retrieve(query)
        except Exception as exc:
            self._last_error = f"Milvus semantic retrieval failed: {exc}"
            return []

        sources: list[dict[str, Any]] = []
        for node in nodes:
            node_payload = getattr(node, "node", node)
            metadata = dict(getattr(node_payload, "metadata", {}) or getattr(node, "metadata", {}) or {})
            content = ""
            if hasattr(node_payload, "get_content"):
                content = str(node_payload.get_content() or "")

            score = float(getattr(node, "score", 0.0) or getattr(node_payload, "score", 0.0) or 0.0)

            sources.append(
                {
                    "title": str(metadata.get("title") or metadata.get("doc_title") or "Vector Source"),
                    "path": str(metadata.get("path") or metadata.get("source_path") or "vector://milvus"),
                    "source_type": str(metadata.get("source_type") or "vector"),
                    "snippet": " ".join(content.split())[:220],
                    "score": score,
                }
            )

        return sources

    def _merge_sources(
        self,
        semantic_sources: list[dict[str, Any]],
        keyword_sources: list[dict[str, Any]],
        max_sources: int,
    ) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        seen_keys: set[tuple[str, str]] = set()

        for source in semantic_sources + keyword_sources:
            key = (str(source.get("path", "")), str(source.get("title", "")))
            if key in seen_keys:
                continue
            seen_keys.add(key)
            merged.append(source)
            if len(merged) >= max_sources:
                break

        return merged

    def run(
        self,
        query: str,
        max_sources: int,
        keyword_sources: list[dict[str, Any]],
        source_documents: list[Any] | None = None,
    ) -> dict[str, Any]:
        if self.mode == "keyword":
            return {
                "sources": keyword_sources[:max_sources],
                "retrieval_method": "keyword",
                "vector_db": self.health(),
            }

        index_state = self.sync_documents(source_documents or [])

        semantic_sources = self._semantic_retrieve(query=query, max_sources=max_sources)
        vector_db = self.health()
        vector_db.update({
            "index_state": index_state,
        })

        if self.mode == "semantic":
            if semantic_sources:
                return {
                    "sources": semantic_sources[:max_sources],
                    "retrieval_method": "semantic",
                    "vector_db": vector_db,
                }
            return {
                "sources": keyword_sources[:max_sources],
                "retrieval_method": "keyword_fallback",
                "vector_db": vector_db,
            }

        # Hybrid mode: semantic first, then keyword fill.
        if semantic_sources:
            merged = self._merge_sources(semantic_sources, keyword_sources, max_sources=max_sources)
            return {
                "sources": merged,
                "retrieval_method": "hybrid",
                "vector_db": vector_db,
            }

        return {
            "sources": keyword_sources[:max_sources],
            "retrieval_method": "keyword_fallback",
            "vector_db": vector_db,
        }
