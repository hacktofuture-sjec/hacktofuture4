"""
news_fetcher.py
Fetches articles from free RSS feeds. No API key required.
"""

import re
import hashlib
import feedparser
from datetime import datetime
from typing import List, Dict


RSS_SOURCES = [
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",   "name": "BBC Business"},
    {"url": "https://techcrunch.com/feed/",                      "name": "TechCrunch"},
    {"url": "https://hnrss.org/frontpage",                       "name": "Hacker News"},
    {"url": "https://www.theverge.com/rss/index.xml",            "name": "The Verge"},
    {"url": "https://feeds.arstechnica.com/arstechnica/index",   "name": "Ars Technica"},
]

MAX_PER_FEED = 12


def _clean_html(text: str) -> str:
    """Strip HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_articles() -> List[Dict]:
    """
    Pull articles from all RSS sources and return a deduplicated list.
    Returns list of dicts: {title, url, source, published, summary, full_text}
    """
    articles: List[Dict] = []
    seen_hashes: set = set()

    for source in RSS_SOURCES:
        try:
            feed = feedparser.parse(source["url"])
            for entry in feed.entries[:MAX_PER_FEED]:
                url = entry.get("link", "")
                if not url:
                    continue

                url_hash = hashlib.md5(url.encode()).hexdigest()
                if url_hash in seen_hashes:
                    continue
                seen_hashes.add(url_hash)

                # Summary
                raw_summary = entry.get("summary", "")
                summary = _clean_html(raw_summary)[:600]

                # Full text — try content[0].value first
                raw_full = ""
                if hasattr(entry, "content") and entry.content:
                    raw_full = entry.content[0].get("value", "")
                if not raw_full:
                    raw_full = raw_summary

                full_text = _clean_html(raw_full)[:2500]

                articles.append({
                    "title": _clean_html(entry.get("title", "Untitled"))[:250],
                    "url": url,
                    "source": source["name"],
                    "published": entry.get("published", datetime.utcnow().isoformat()),
                    "summary": summary,
                    "full_text": full_text,
                })
        except Exception as exc:
            print(f"[news_fetcher] Error fetching {source['name']}: {exc}")

    return articles
