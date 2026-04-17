import requests
from bs4 import BeautifulSoup
import time


def scrape_nitter(query: str, max_posts: int = 30) -> list[dict]:
    """
    Scrape Nitter (free Twitter/X mirror) for mentions of a product/term.

    Args:
        query: Search term, e.g. 'yourproductname bug'
        max_posts: Maximum number of posts to return

    Returns:
        List of normalized feedback dicts
    """
    nitter_instances = [
        "https://nitter.privacydev.net",
        "https://nitter.poast.org",
        "https://nitter.cz",
    ]

    results = []
    for base_url in nitter_instances:
        try:
            url = f"{base_url}/search?q={requests.utils.quote(query)}&f=tweets"
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            }
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code != 200:
                print(f"[Nitter] {base_url} returned {response.status_code}")
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            tweet_divs = soup.find_all("div", class_="tweet-content")

            if not tweet_divs:
                print(f"[Nitter] No tweets found at {base_url}")
                continue

            for tweet in tweet_divs[:max_posts]:
                text = tweet.get_text(strip=True)
                if len(text) < 10:
                    continue
                results.append({
                    "source": "twitter",
                    "text": text,
                    "url": base_url,
                    "author": "scraped",
                })

            print(f"[Nitter] Scraped {len(results)} tweets from {base_url}")
            break  # stop if one instance works

        except Exception as e:
            print(f"[Nitter] Instance {base_url} failed: {e}")
            continue

    return results


def scrape_reddit(subreddit: str, query: str, max_posts: int = 20) -> list[dict]:
    """
    Scrape Reddit using the free public JSON API (no auth needed for public posts).

    Args:
        subreddit: e.g. 'webdev' or 'programming'
        query: Search term
        max_posts: Maximum number of posts to return

    Returns:
        List of normalized feedback dicts
    """
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {"q": query, "sort": "new", "limit": max_posts, "restrict_sr": 1}
    headers = {"User-Agent": "vectorplusplus/1.0 (feedback aggregator)"}

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        results = []
        for post in data.get("data", {}).get("children", []):
            p = post["data"]
            title = p.get("title", "")
            body = p.get("selftext", "")

            # Truncate
            combined = f"{title}. {body[:500]}" if body else title

            results.append({
                "source": "reddit",
                "text": combined.strip(),
                "url": f"https://reddit.com{p['permalink']}",
                "author": p.get("author", "unknown"),
            })

        print(f"[Reddit] Scraped {len(results)} posts from r/{subreddit}")
        return results

    except Exception as e:
        print(f"[Reddit] Error scraping r/{subreddit}: {e}")
        return []


def scrape_hackernews(query: str, max_posts: int = 20) -> list[dict]:
    """
    Scrape HackerNews using the Algolia API (free, no auth).
    """
    url = "https://hn.algolia.com/api/v1/search"
    params = {"query": query, "tags": "comment", "hitsPerPage": max_posts}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        results = []
        for hit in data.get("hits", []):
            text = hit.get("comment_text") or hit.get("title") or ""
            # Strip HTML
            soup = BeautifulSoup(text, "html.parser")
            clean_text = soup.get_text(strip=True)

            if len(clean_text) < 20:
                continue

            results.append({
                "source": "hackernews",
                "text": clean_text[:600],
                "url": f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}",
                "author": hit.get("author", "unknown"),
            })

        print(f"[HackerNews] Scraped {len(results)} comments for '{query}'")
        return results

    except Exception as e:
        print(f"[HackerNews] Error: {e}")
        return []
