from database.db import get_supabase
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def save_feedback(items: list[dict]) -> int:
    """
    Save raw feedback to DB, deduplicating by URL.

    Args:
        items: List of dicts with keys: source, text, url, author

    Returns:
        Number of new items inserted
    """
    if not items:
        return 0

    sb = get_supabase()
    inserted = 0

    for item in items:
        # Skip items with empty text or URL
        if not item.get("text") or not item.get("url"):
            continue

        # Truncate text if too long
        item["text"] = item["text"][:2000]

        try:
            # Deduplicate by URL
            existing = (
                sb.table("feedback")
                .select("id")
                .eq("url", item["url"])
                .execute()
            )
            if not existing.data:
                # Strip out keys that are not in the database schema
                clean_item = {
                    "id": item.get("id"),
                    "source": item.get("source"),
                    "text": item.get("text"),
                    "url": item.get("url"),
                    "author": item.get("author")
                }
                sb.table("feedback").insert(clean_item).execute()
                inserted += 1
        except Exception as e:
            print(f"[Normalizer] Error inserting item: {e}")
            continue

    print(f"[Normalizer] Saved {inserted} new feedback items (skipped {len(items) - inserted} duplicates)")
    return inserted
