"""
Hybrid RAG retrieval using Reciprocal Rank Fusion (RRF).
Merges Elasticsearch (BM25) and Qdrant (cosine similarity) results.
RRF eliminates incompatible score space problem between BM25 and cosine.
"""
from elasticsearch import Elasticsearch
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, SearchRequest

es = Elasticsearch("http://localhost:9200")
qdrant = QdrantClient(host="localhost", port=6333)
COLLECTION_NAME = "voxbridge_docs"
RRF_K = 60  # Standard RRF smoothing constant
ES_INDEX_PREFIX = "voxbridge_docs"


def embed_query(query: str) -> list[float]:
    """Replace with your embedding model. Must return 1536-dim vector."""
    raise NotImplementedError("Implement embedding call here.")


def reciprocal_rank_fusion(
    *ranked_lists: list[dict],
    k: int = RRF_K
) -> list[dict]:
    """
    Merges multiple ranked lists using RRF.
    RRF Score = sum(1 / (k + rank_i))
    Ignores raw scores entirely -- operates on ordinal rank positions only.
    """
    scores: dict[str, float] = {}
    docs: dict[str, dict] = {}

    for ranked_list in ranked_lists:
        for rank, doc in enumerate(ranked_list, start=1):
            doc_id = doc["chunk_id"]
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
            docs[doc_id] = doc

    return sorted(docs.values(), key=lambda d: scores[d["chunk_id"]], reverse=True)


def retrieve(query: str, tenant_id: str, top_k: int = 5) -> list[dict]:
    """Hybrid retrieval: BM25 + semantic cosine, fused with RRF."""

    # 1. Elasticsearch BM25 retrieval
    es_results = es.search(
        index=f"{ES_INDEX_PREFIX}_{tenant_id}",
        query={"match": {"text": query}},
        size=top_k * 2
    )
    bm25_docs = [
        {**hit["_source"], "chunk_id": hit["_id"]}
        for hit in es_results["hits"]["hits"]
    ]

    # 2. Qdrant semantic retrieval (tenant-isolated sub-index)
    query_vector = embed_query(query)
    qdrant_results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        ),
        limit=top_k * 2
    )
    qdrant_docs = [
        {**hit.payload, "chunk_id": str(hit.id)}
        for hit in qdrant_results
    ]

    # 3. Merge with RRF
    fused = reciprocal_rank_fusion(bm25_docs, qdrant_docs)
    return fused[:top_k]
