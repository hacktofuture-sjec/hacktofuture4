from __future__ import annotations

import re

from src.memory.three_tier_memory import MemoryDocument, ThreeTierMemory


class RetrievalSwarm:
    def __init__(self, memory: ThreeTierMemory, max_sources: int = 4) -> None:
        self.memory = memory
        self.max_sources = max_sources

    def _tokenize(self, query: str) -> list[str]:
        return [token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) > 2]

    def _score(self, doc: MemoryDocument, query_tokens: list[str]) -> int:
        haystack = f"{doc.title} {doc.content}".lower()
        return sum(haystack.count(token) for token in query_tokens)

    def run(self, query: str) -> dict:
        query_tokens = self._tokenize(query)
        docs = self.memory.load_documents()
        ranked: list[tuple[int, MemoryDocument]] = []
        for doc in docs:
            ranked.append((self._score(doc, query_tokens), doc))

        ranked.sort(key=lambda item: item[0], reverse=True)
        top_ranked = ranked[: self.max_sources]
        if top_ranked and top_ranked[0][0] == 0:
            top_ranked = ranked[: min(len(ranked), 2)]

        sources: list[dict] = []
        for score, doc in top_ranked:
            snippet = " ".join(doc.content.strip().split())[:220]
            sources.append(
                {
                    "title": doc.title,
                    "path": doc.path,
                    "source_type": doc.source_type,
                    "snippet": snippet,
                    "score": score,
                }
            )

        return {
            "query": query,
            "sources": sources,
            "source_count": len(sources),
        }
