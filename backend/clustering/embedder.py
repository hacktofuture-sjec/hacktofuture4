from sentence_transformers import SentenceTransformer
from database.db import get_supabase
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load model once (downloads ~90MB on first run, cached after)
print("[Embedder] Loading sentence-transformer model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("[Embedder] Model loaded.")


def embed_feedback(batch_size: int = 64) -> int:
    """
    Generate vector embeddings for all unembedded feedback in DB.
    Uses local model — no API cost.

    Args:
        batch_size: How many items to embed per batch

    Returns:
        Number of items embedded
    """
    sb = get_supabase()

    # Fetch un-embedded feedback
    rows = (
        sb.table("feedback")
        .select("id, text")
        .is_("embedding", "null")
        .execute()
    )

    if not rows.data:
        print("[Embedder] Nothing to embed.")
        return 0

    texts = [r["text"] for r in rows.data]
    ids = [r["id"] for r in rows.data]

    print(f"[Embedder] Generating embeddings for {len(texts)} items...")

    # Generate in batches
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        embeddings = model.encode(batch, show_progress_bar=False, normalize_embeddings=True)
        all_embeddings.extend(embeddings)

    print(f"[Embedder] Generated {len(all_embeddings)} embeddings. Saving to DB...")

    # Save back to DB
    saved = 0
    for id_, emb in zip(ids, all_embeddings):
        try:
            sb.table("feedback").update(
                {"embedding": emb.tolist()}
            ).eq("id", id_).execute()
            saved += 1
        except Exception as e:
            print(f"[Embedder] Error saving embedding for {id_}: {e}")

    print(f"[Embedder] Saved {saved} embeddings.")
    return saved


def get_embedding(text: str) -> list[float]:
    """Get embedding for a single text string."""
    emb = model.encode([text], normalize_embeddings=True)
    return emb[0].tolist()
