from github import Github
import os
from dotenv import load_dotenv

load_dotenv()


def scrape_github_issues(repo_name: str, max_issues: int = 50) -> list[dict]:
    """
    Scrape open issues from a GitHub repository.

    Args:
        repo_name: e.g. 'facebook/react'
        max_issues: Maximum number of issues to scrape (default 50)

    Returns:
        List of normalized feedback dicts
    """
    token = os.getenv("GITHUB_TOKEN")
    g = Github(token) if token else Github()
    
    try:
        repo = g.get_repo(repo_name)
        issues = repo.get_issues(state="open")

        results = []
        for i, issue in enumerate(issues):
            if i >= max_issues:
                break
            # Skip pull requests (GitHub API returns them in issues endpoint)
            if issue.pull_request:
                continue

            body_text = issue.body or ""
            # Truncate very long bodies
            if len(body_text) > 1000:
                body_text = body_text[:1000] + "..."

            results.append({
                "source": "github",
                "text": f"{issue.title}. {body_text}".strip(),
                "url": issue.html_url,
                "author": issue.user.login,
            })

        print(f"[GitHub] Scraped {len(results)} issues from {repo_name}")
        return results

    except Exception as e:
        print(f"[GitHub] Error scraping {repo_name}: {e}")
        return []


def scrape_github_discussions(repo_name: str, max_items: int = 20) -> list[dict]:
    """
    Scrape GitHub issue comments for additional feedback signals.
    """
    token = os.getenv("GITHUB_TOKEN")
    g = Github(token) if token else Github()
    
    try:
        repo = g.get_repo(repo_name)
        issues = repo.get_issues(state="open")

        results = []
        for issue in list(issues)[:max_items]:
            if issue.pull_request:
                continue
            comments = issue.get_comments()
            for comment in list(comments)[:3]:  # top 3 comments per issue
                results.append({
                    "source": "github",
                    "text": comment.body[:500] if comment.body else "",
                    "url": comment.html_url,
                    "author": comment.user.login,
                })

        print(f"[GitHub] Scraped {len(results)} comments from {repo_name}")
        return results

    except Exception as e:
        print(f"[GitHub] Error scraping comments from {repo_name}: {e}")
        return []
