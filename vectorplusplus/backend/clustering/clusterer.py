from sklearn.cluster import DBSCAN
from database.db import get_supabase
import numpy as np
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _normalize_embedding(value) -> list[float] | None:
    """Return embedding as numeric list, handling DB stringified arrays."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        if isinstance(parsed, list):
            try:
                return [float(x) for x in parsed]
            except (TypeError, ValueError):
                return None
        return None
    if isinstance(value, list):
        try:
            return [float(x) for x in value]
        except (TypeError, ValueError):
            return None
    return None


def cluster_feedback(
    eps: float = 0.35,
    min_samples: int = 2,
) -> int:
    """
    Group similar feedback into clusters using DBSCAN on cosine distance.

    Args:
        eps: Neighborhood radius (lower = stricter similarity)
        min_samples: Min items to form a cluster

    Returns:
        Number of clusters created
    """
    sb = get_supabase()

    rows = (
        sb.table("feedback")
        .select("id, text, embedding")
        .not_.is_("embedding", "null")
        .eq("status", "raw")
        .execute()
    )

    if not rows.data:
        print("[Clusterer] No un-clustered feedback with embeddings found.")
        return 0

    if len(rows.data) < min_samples:
        print(f"[Clusterer] Not enough feedback to cluster (need {min_samples}, have {len(rows.data)})")
        return 0

    parsed_rows: list[dict] = []
    for r in rows.data:
        emb = _normalize_embedding(r.get("embedding"))
        if emb is None:
            continue
        parsed_rows.append({"id": r["id"], "text": r["text"], "embedding": emb})

    if len(parsed_rows) < min_samples:
        print(
            f"[Clusterer] Not enough valid embeddings to cluster "
            f"(need {min_samples}, have {len(parsed_rows)})."
        )
        return 0

    ids = [r["id"] for r in parsed_rows]
    texts = [r["text"] for r in parsed_rows]
    embeddings = np.array([r["embedding"] for r in parsed_rows], dtype=np.float32)

    print(f"[Clusterer] Running DBSCAN on {len(embeddings)} items...")

    # DBSCAN with cosine metric — no need to specify number of clusters
    db = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine", n_jobs=-1)
    labels = db.fit_predict(embeddings)

    # Group by cluster label
    clusters: dict[int, list[dict]] = {}
    for id_, text, label in zip(ids, texts, labels):
        if label == -1:  # noise/outlier
            continue
        if label not in clusters:
            clusters[label] = []
        clusters[label].append({"id": id_, "text": text})

    if not clusters:
        print("[Clusterer] No clusters formed. Try adjusting eps/min_samples.")
        return 0

    print(f"[Clusterer] Found {len(clusters)} clusters. Saving to DB...")

    created = 0
    for label, items in clusters.items():
        # Priority score = number of reports (more = higher priority)
        priority = float(len(items))

        # Generate a descriptive label from top item text (truncated)
        sample_text = items[0]["text"][:80].strip()
        cluster_label = f'Issue cluster #{label}: "{sample_text}..."'

        try:
            result = (
                sb.table("clusters")
                .insert({
                    "label": cluster_label,
                    "priority_score": priority,
                    "feedback_count": len(items),
                    "status": "pending",
                })
                .execute()
            )

            cluster_id = result.data[0]["id"]

            # Link feedback to cluster
            for item in items:
                sb.table("feedback").update({
                    "cluster_id": cluster_id,
                    "status": "clustered",
                }).eq("id", item["id"]).execute()

            created += 1
        except Exception as e:
            print(f"[Clusterer] Error creating cluster {label}: {e}")

    print(f"[Clusterer] Created {created} clusters.")
    return created


def recluster_all(eps: float = 0.35, min_samples: int = 2) -> int:
    """
    Re-cluster ALL feedback (including already-clustered items).
    Use this when you want a fresh clustering pass.
    """
    sb = get_supabase()

    # Reset all feedback status to raw
    sb.table("feedback").update({"cluster_id": None, "status": "raw"}).neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()

    # Delete existing clusters
    sb.table("clusters").delete().neq("id", -1).execute()

    return cluster_feedback(eps=eps, min_samples=min_samples)
