"""
Notifier — closes the feedback loop by posting a GitHub comment on each
original issue that was part of the cluster, telling users a fix PR is ready.
"""
import os
from github import Github, GithubException
from dotenv import load_dotenv

load_dotenv()


def notify_github_issues(
    repo_name: str,
    cluster_id: int,
    pr_url: str,
    analysis: dict,
) -> int:
    """
    Post a friendly comment on every GitHub issue that belongs to this cluster
    so the reporters get notified that a fix is on its way.

    Args:
        repo_name:  e.g. 'owner/repo'
        cluster_id: DB cluster ID used to find linked feedback
        pr_url:     URL of the auto-generated pull request
        analysis:   Analyzer output dict (issue_title, severity, …)

    Returns:
        Number of issues successfully notified
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        print("[Notifier] No GITHUB_TOKEN set — skipping GitHub notifications.")
        return 0

    from database.db import get_supabase

    sb = get_supabase()

    # Fetch all feedback in this cluster that came from GitHub and has a URL
    rows = (
        sb.table("feedback")
        .select("url")
        .eq("cluster_id", cluster_id)
        .eq("source", "github")
        .execute()
    )

    if not rows.data:
        print(f"[Notifier] No GitHub-sourced feedback found for cluster {cluster_id}.")
        return 0

    g = Github(token)
    notified = 0

    for row in rows.data:
        url = row.get("url", "")
        # GitHub issue URLs look like:
        #   https://github.com/owner/repo/issues/123
        if "/issues/" not in url:
            continue

        try:
            # Parse issue number from URL
            parts = url.rstrip("/").split("/")
            issue_number = int(parts[-1])

            repo = g.get_repo(repo_name)
            issue = repo.get_issue(number=issue_number)

            comment_body = (
                f"👋 **Hey! Vector++ has automatically generated a fix for this issue.**\n\n"
                f"**Issue identified:** {analysis.get('issue_title', 'Auto-fix')}\n"
                f"**Severity:** `{analysis.get('severity', 'unknown')}`\n"
                f"**Affected area:** {analysis.get('affected_area', 'unknown')}\n\n"
                f"A pull request has been opened with the proposed fix:\n"
                f"➡️ **{pr_url}**\n\n"
                f"Please review the PR and merge if it looks good. "
                f"The fix was generated autonomously by [Vector++](https://github.com) "
                f"based on aggregated user feedback.\n\n"
                f"*This comment was posted automatically. "
                f"Cluster ID: `{cluster_id}`*"
            )

            issue.create_comment(comment_body)
            print(f"[Notifier] ✅ Commented on issue #{issue_number} in {repo_name}")
            notified += 1

        except (ValueError, IndexError):
            print(f"[Notifier] Could not parse issue number from URL: {url}")
        except GithubException as e:
            print(f"[Notifier] GitHub error on {url}: {e}")
        except Exception as e:
            print(f"[Notifier] Unexpected error on {url}: {e}")

    print(f"[Notifier] Notified {notified} GitHub issues for cluster {cluster_id}.")
    return notified
