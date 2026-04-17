"""
Setup Qdrant multi-tenant collection with sub-index isolation.
m=0 disables global HNSW index; payload_m=16 builds isolated per-tenant sub-HNSW graphs.
Query latency drops from ~200ms (global scan) to ~2ms (isolated sub-index).
"""
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, HnswConfigDiff, PayloadSchemaType
)

COLLECTION_NAME = "voxbridge_docs"

def setup_qdrant(host: str = "localhost", port: int = 6333):
    client = QdrantClient(host=host, port=port)

    # Delete collection if exists (for idempotent re-runs)
    collections = client.get_collections().collections
    if any(c.name == COLLECTION_NAME for c in collections):
        client.delete_collection(collection_name=COLLECTION_NAME)
        print(f"Deleted existing collection '{COLLECTION_NAME}'.")

    # Create collection with multi-tenant HNSW config
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        hnsw_config=HnswConfigDiff(m=0, payload_m=16)
    )

    # Create mandatory tenant_id payload index for sub-index isolation
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="tenant_id",
        field_schema=PayloadSchemaType.KEYWORD
    )
    print(f"Collection '{COLLECTION_NAME}' created with multi-tenant sub-indexing.")

if __name__ == "__main__":
    setup_qdrant()
