from github import Github, GithubException
import os
from dotenv import load_dotenv

load_dotenv()

_SCOPE_HELP = (
    "GitHub API 403: Your token has the right scopes, but the organization may require "
    "SSO authorization. Go to https://github.com/settings/tokens, find your token, "
    "and click 'Configure SSO' next to it — then authorize the org (e.g. A-ES). "
    "Alternatively, create a Fine-grained token scoped directly to the target repo "
    "with 'Contents: Read & write' and 'Pull requests: Read & write'."
)


def create_pr(
    repo_name: str,
    patches: list[dict],
    test_file: dict,
    analysis: dict,
    cluster_id: int,
    sandbox_passed: bool = True,
) -> str:
    """
    Create a GitHub branch, apply code patches, add tests, and open a PR.

    Args:
        repo_name: e.g. 'owner/repo'
        patches: List of {file_path, new_code, change_summary} dicts
        test_file: {test_file_path, test_code} dict
        analysis: Analyzer output dict
        cluster_id: DB cluster ID for branch naming
        sandbox_passed: Whether Docker sandbox tests passed before this PR

    Returns:
        URL of the created pull request
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN environment variable not set")

    g = Github(token)
    repo = g.get_repo(repo_name)

    branch_name = f"fix/auto-cluster-{cluster_id}"
    base_branch = "main"

    # Try main, fall back to master
    try:
        base_sha = repo.get_branch(base_branch).commit.sha
    except GithubException:
        base_branch = "master"
        base_sha = repo.get_branch(base_branch).commit.sha

    # Create branch (idempotent — skip if it already exists)
    try:
        repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base_sha)
        print(f"[PR Creator] Created branch {branch_name}")
    except GithubException as e:
        if "already exists" in str(e):
            print(f"[PR Creator] Branch {branch_name} already exists, reusing.")
        else:
            raise

    # Apply each code patch
    for patch in patches:
        if not patch.get("file_path") or not patch.get("new_code"):
            continue
        path = patch["file_path"].lstrip("/")
        new_code = patch["new_code"]
        commit_msg = f"fix: {patch.get('change_summary', 'auto-patch from Vector++')}"

        try:
            existing = repo.get_contents(path, ref=branch_name)
            repo.update_file(path, commit_msg, new_code, existing.sha, branch=branch_name)
            print(f"[PR Creator] Updated {path}")
        except GithubException as get_err:
            if get_err.status == 404:
                # File doesn't exist — create it
                try:
                    repo.create_file(path, commit_msg, new_code, branch=branch_name)
                    print(f"[PR Creator] Created {path}")
                except GithubException as create_err:
                    print(f"[PR Creator] Failed to create {path}: {create_err}")
                    raise
            else:
                print(f"[PR Creator] Failed to read/update {path}: {get_err}")
                raise

    # Add generated test file
    if test_file and test_file.get("test_file_path") and test_file.get("test_code"):
        test_path = test_file["test_file_path"].lstrip("/")
        try:
            existing = repo.get_contents(test_path, ref=branch_name)
            repo.update_file(
                test_path,
                "test: update auto-generated tests",
                test_file["test_code"],
                existing.sha,
                branch=branch_name,
            )
        except GithubException:
            try:
                repo.create_file(
                    test_path,
                    "test: add auto-generated tests from Vector++",
                    test_file["test_code"],
                    branch=branch_name,
                )
                print(f"[PR Creator] Created test file {test_path}")
            except GithubException as e:
                print(f"[PR Creator] Failed to write test file: {e}")

    # Build PR description
    files_changed = "\n".join([f"- `{p['file_path']}`" for p in patches if p.get("file_path")])
    test_info = f"- `{test_file['test_file_path']}`" if test_file and test_file.get("test_file_path") else "(none)"

    sandbox_badge = (
        "✅ **Sandbox tests passed** before this PR was created."
        if sandbox_passed
        else "⚠️ **Sandbox tests did not fully pass.** Please review carefully before merging."
    )

    sandbox_warning = (
        f"\n> {analysis.get('_sandbox_warning', '')}"
        if not sandbox_passed and analysis.get('_sandbox_warning')
        else ""
    )

    pr_body = f"""## 🤖 Auto-generated fix by Vector++

**Issue Type:** {analysis.get('issue_type', 'unknown')}  
**Severity:** {analysis.get('severity', 'unknown')}  
**Affected Area:** {analysis.get('affected_area', 'unknown')}  
**Sandbox:** {sandbox_badge}
{sandbox_warning}

### Problem
{analysis.get('description', 'See cluster analysis.')}

### Root Cause
{analysis.get('root_cause', 'Unknown')}

### Files Changed
{files_changed or "(none)"}

### Tests Added
{test_info}

### User Impact
{analysis.get('user_impact', 'Unknown')}

---
*This PR was autonomously generated by **Vector++** based on user feedback clustering.  
Cluster ID: `{cluster_id}` | Please review before merging.*
"""

    # Create the PR
    try:
        pr = repo.create_pull(
            title=f"[Vector++] {analysis.get('issue_title', 'Auto-fix')}",
            body=pr_body,
            head=branch_name,
            base=base_branch,
        )
    except GithubException as e:
        if e.status == 403:
            raise RuntimeError(
                f"GitHub API 403 when creating PR. {_SCOPE_HELP}"
            ) from e
        if e.status == 422 and "already exists" in str(e):
            # PR already open for this branch — find and return its URL
            existing_prs = repo.get_pulls(state="open", head=f"{repo.owner.login}:{branch_name}")
            for existing_pr in existing_prs:
                print(f"[PR Creator] PR already exists: {existing_pr.html_url}")
                return existing_pr.html_url
        raise
    print(f"[PR Creator] PR created: {pr.html_url}")
    return pr.html_url
