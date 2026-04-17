"""
Ingests tenant documentation into Elasticsearch (BM25) and Qdrant (semantic).
Chunks documents into <=512 tokens with 50-token overlap.
Stores metadata: tenant_id, chunk_id, position, text, document_type.
"""
import argparse
import hashlib
from elasticsearch import Elasticsearch
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

CHUNK_SIZE = 512    # tokens
CHUNK_OVERLAP = 50  # tokens
COLLECTION_NAME = "voxbridge_docs"
ES_INDEX_PREFIX = "voxbridge_docs"


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Simple word-based chunker. Replace with tiktoken for production."""
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


def embed_text(text: str) -> list[float]:
    """
    Replace with your embedding model call. Must return 1536-dim vector.
    Example: Use OpenAI text-embedding-3-small or a local sentence-transformers model.
    """
    raise NotImplementedError(
        "Implement embedding call here. "
        "Example: from openai import OpenAI; client = OpenAI(); "
        "return client.embeddings.create(input=text, model='text-embedding-3-small').data[0].embedding"
    )


def ingest(tenant_id: str, docs_path: str):
    es = Elasticsearch("http://localhost:9200")
    qdrant = QdrantClient(host="localhost", port=6333)

    es_index = f"{ES_INDEX_PREFIX}_{tenant_id}"

    # Create ES index if not exists
    if not es.indices.exists(index=es_index):
        es.indices.create(index=es_index)
        print(f"Created Elasticsearch index: {es_index}")

    with open(docs_path, "r") as f:
        raw_text = f.read()

    chunks = chunk_text(raw_text, CHUNK_SIZE, CHUNK_OVERLAP)
    points = []

    for i, chunk in enumerate(chunks):
        chunk_id = hashlib.sha256(f"{tenant_id}_{i}_{chunk[:50]}".encode()).hexdigest()
        vector = embed_text(chunk)
        payload = {
            "tenant_id": tenant_id,
            "chunk_id": chunk_id,
            "position": i,
            "text": chunk,
            "document_type": "product_documentation"
        }

        # Index in Elasticsearch for BM25
        es.index(index=es_index, id=chunk_id, document=payload)

        # Index in Qdrant for semantic retrieval
        points.append(PointStruct(id=chunk_id[:36], vector=vector, payload=payload))

    if points:
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

    print(f"Ingested {len(chunks)} chunks for tenant '{tenant_id}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest documents into Elasticsearch and Qdrant")
    parser.add_argument("--tenant-id", required=True, help="Tenant identifier")
    parser.add_argument("--docs-path", required=True, help="Path to text file to ingest")
    args = parser.parse_args()
    ingest(args.tenant_id, args.docs_path)
