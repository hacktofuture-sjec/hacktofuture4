"""
Pipeline Orchestrator — connects all 4 agents and runs the full fix cycle
for a given feedback cluster.

Pipeline flow:
    feedback texts
        → Analyzer       (what's broken)
        → Planner        (how to fix, enriched with learnings context)
        → Coder          (write patch)
        → Tester         (write tests)
        → Sandbox        (validate tests before touching real repo)
        → PR Creator     (open GitHub PR)
        → Notifier       (comment on original GitHub issues)
        → Learning       (record outcome for future improvement)
"""
from database.db import get_supabase
from agents import analyzer, planner, coder, tester
from github_automation.pr_creator import create_pr
from sandbox.runner import run_in_sandbox
from notifications.notifier import notify_github_issues
from learning.memory import record_fix_attempt, build_learnings_context
from github import Github
import os
import sys
import json
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _sb():
    return get_supabase()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_agent(
    cluster_id: int,
    agent_name: str,
    status: str,
    input_data,
    output_data,
    run_id: str | None = None,
) -> str:
    """Insert or update an agent_run log record. Returns the run_id."""
    truncate = lambda v: str(v)[:2000]
    data_base = {
        "cluster_id": cluster_id,
        "agent_name": agent_name,
        "status": status,
    }
    data_rich = {
        **data_base,
        "input": truncate(input_data),
        "output": truncate(output_data),
    }

    def _insert(payload: dict) -> str:
        result = _sb().table("agent_runs").insert(payload).execute()
        return result.data[0]["id"]

    def _update(payload: dict) -> None:
        _sb().table("agent_runs").update(payload).eq("id", run_id).execute()

    if run_id:
        try:
            _update({**data_rich, "finished_at": _now()})
        except Exception:
            _update({**data_base, "finished_at": _now()})
        return run_id
    else:
        try:
            return _insert(data_rich)
        except Exception:
            return _insert(data_base)


def get_repo_files(repo_name: str, file_paths: list[str]) -> dict:
    """Fetch file contents from a GitHub repo."""
    g = Github(os.getenv("GITHUB_TOKEN"))
    contents: dict[str, str] = {}
    try:
        repo = g.get_repo(repo_name)
        for path in file_paths:
            try:
                f = repo.get_contents(path)
                contents[path] = f.decoded_content.decode("utf-8", errors="replace")
            except Exception:
                pass
    except Exception as e:
        print(f"[Orchestrator] Could not access repo {repo_name}: {e}")
    return contents


def get_repo_tree(repo_name: str) -> str:
    """Fetch the full file structures of a GitHub repo."""
    g = Github(os.getenv("GITHUB_TOKEN"))
    try:
        repo = g.get_repo(repo_name)
        tree = repo.get_git_tree(repo.default_branch, recursive=True)
        # Filter out massive directories, node_modules, etc to save tokens
        paths = [
            t.path for t in tree.tree 
            if t.type == 'blob' 
            and not t.path.startswith("node_modules/") 
            and not t.path.startswith(".git/")
            and not t.path.startswith("dist/")
            and not t.path.startswith("build/")
        ]
        return "\n".join(paths)
    except Exception as e:
        print(f"[Orchestrator] Could not fetch repo tree for {repo_name}: {e}")
        return "(tree unavailable)"


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(cluster_id: int, repo_name: str) -> dict:
    """
    Run the full pipeline for one feedback cluster.

    Returns a dict with:
        success  (bool)
        pr_url   (str, on success)
        sandbox  (dict, sandbox result)
        notified (int, issues notified)
        error    (str, on failure)
    """
    print(f"\n[Pipeline] Starting for cluster_id={cluster_id}, repo={repo_name}")

    # Mark cluster as running
    _sb().table("clusters").update({"status": "running"}).eq("id", cluster_id).execute()

    # Pull feedback texts
    feedback_rows = (
        _sb().table("feedback")
        .select("text")
        .eq("cluster_id", cluster_id)
        .execute()
    )
    texts = [r["text"] for r in feedback_rows.data]

    if not texts:
        return {"success": False, "error": "No feedback found for this cluster"}

    current_agent = "pipeline"
    current_run_id: str | None = None
    try:
        # ── AGENT 1: ANALYZER ───────────────────────────────────────────────
        print("[Pipeline] Running Analyzer...")
        current_agent = "analyzer"
        
        # Give analyzer the actual codebase context
        repo_tree = get_repo_tree(repo_name)
        
        run_id = log_agent(cluster_id, "analyzer", "running", texts, "")
        current_run_id = run_id
        analysis = analyzer.analyze(texts, repo_tree)
        log_agent(cluster_id, "analyzer", "done", texts, analysis, run_id)
        print(f"[Pipeline] Analysis: {analysis.get('issue_title')}")

        # ── LEARNING CONTEXT (few-shot enrichment for Planner) ───────────────
        print("[Pipeline] Fetching learnings context...")
        learnings_ctx = build_learnings_context(
            issue_type=analysis.get("issue_type", ""),
            affected_area=analysis.get("affected_area", ""),
        )
        if learnings_ctx:
            print("[Pipeline] Injecting past successful fixes into Planner context.")

        # ── AGENT 2: PLANNER ────────────────────────────────────────────────
        print("[Pipeline] Running Planner...")
        file_contents = get_repo_files(repo_name, analysis.get("suggested_files", []))
        current_agent = "planner"
        run_id = log_agent(cluster_id, "planner", "running", analysis, "")
        current_run_id = run_id
        repo_context = "\n\n".join([
            f"=== {p} ===\n{c[:800]}" for p, c in file_contents.items()
        ]) or "(repo files unavailable)"
        plan = planner.plan(analysis, repo_context, learnings_ctx)
        log_agent(cluster_id, "planner", "done", analysis, plan, run_id)

        # ── AGENT 3: CODER ──────────────────────────────────────────────────
        print("[Pipeline] Running Coder...")
        current_agent = "coder"
        run_id = log_agent(cluster_id, "coder", "running", plan, "")
        current_run_id = run_id
        code_result = coder.generate_code(plan, file_contents)
        log_agent(cluster_id, "coder", "done", plan, code_result, run_id)

        # ── AGENT 4: TESTER ─────────────────────────────────────────────────
        print("[Pipeline] Running Tester...")
        current_agent = "tester"
        run_id = log_agent(cluster_id, "tester", "running", code_result, "")
        current_run_id = run_id
        test_result = tester.generate_tests(analysis, code_result.get("patches", []))
        log_agent(cluster_id, "tester", "done", code_result, test_result, run_id)

        # ── SANDBOX VALIDATION ───────────────────────────────────────────────
        print("[Pipeline] Running Sandbox validation...")
        current_agent = "sandbox"
        run_id = log_agent(
            cluster_id, "sandbox", "running",
            {"patch_count": len(code_result.get("patches", []))}, ""
        )
        current_run_id = run_id

        sandbox_result = run_in_sandbox(
            repo_name=repo_name,
            patches=code_result.get("patches", []),
            test_file=test_result,
        )

        log_agent(cluster_id, "sandbox", "done" if sandbox_result["success"] else "failed",
                  {}, sandbox_result, run_id)

        if not sandbox_result["success"]:
            # Sandbox failure — log stderr but still continue to create the PR
            # with a warning in the description (don't block the pipeline entirely
            # as sandbox may lack dependencies the real repo has).
            print(
                f"[Pipeline] ⚠️  Sandbox tests failed (exit {sandbox_result.get('exit_code')}).\n"
                f"  stderr: {sandbox_result.get('stderr', '')[:300]}\n"
                f"  Continuing to create PR with sandbox-failure notice."
            )
            sandbox_passed = False
        else:
            print("[Pipeline] ✅ Sandbox validation passed.")
            sandbox_passed = True

        # ── CREATE PR ────────────────────────────────────────────────────────
        print("[Pipeline] Creating PR...")
        current_agent = "pr_creator"
        run_id = log_agent(
            cluster_id,
            "pr_creator",
            "running",
            {"repo_name": repo_name, "patch_count": len(code_result.get("patches", []))},
            "",
        )
        current_run_id = run_id

        # Augment analysis with sandbox info for PR body
        analysis_for_pr = dict(analysis)
        if not sandbox_passed:
            analysis_for_pr["_sandbox_warning"] = (
                "⚠️ Automated sandbox tests did not all pass. "
                "Please review carefully before merging."
            )

        pr_url = create_pr(
            repo_name=repo_name,
            patches=code_result.get("patches", []),
            test_file=test_result,
            analysis=analysis_for_pr,
            cluster_id=cluster_id,
            sandbox_passed=sandbox_passed,
        )
        log_agent(cluster_id, "pr_creator", "done", {"repo_name": repo_name}, {"pr_url": pr_url}, run_id)

        # Save PR record
        _sb().table("pull_requests").insert({
            "cluster_id": cluster_id,
            "github_pr_url": pr_url,
            "branch_name": f"fix/auto-cluster-{cluster_id}",
            "status": "open",
        }).execute()

        # ── NOTIFY USERS ─────────────────────────────────────────────────────
        print("[Pipeline] Notifying original issue reporters...")
        current_agent = "notifier"
        notified_count = 0
        try:
            notified_count = notify_github_issues(
                repo_name=repo_name,
                cluster_id=cluster_id,
                pr_url=pr_url,
                analysis=analysis,
            )
        except Exception as notify_err:
            # Non-fatal — log and continue
            print(f"[Pipeline] Notifier error (non-fatal): {notify_err}")

        # ── RECORD LEARNING ──────────────────────────────────────────────────
        print("[Pipeline] Recording fix attempt for future learning...")
        current_agent = "learning"
        try:
            record_fix_attempt(
                cluster_id=cluster_id,
                pr_url=pr_url,
                branch_name=f"fix/auto-cluster-{cluster_id}",
                analysis=analysis,
                plan=plan,
                patch_count=len(code_result.get("patches", [])),
                notified_users_count=notified_count,
            )
        except Exception as learn_err:
            print(f"[Pipeline] Learning record error (non-fatal): {learn_err}")

        _sb().table("clusters").update({"status": "done"}).eq("id", cluster_id).execute()

        print(f"[Pipeline] ✅ Done! PR: {pr_url} | Notified: {notified_count} issues")
        return {
            "success": True,
            "pr_url": pr_url,
            "sandbox": sandbox_result,
            "sandbox_passed": sandbox_passed,
            "notified": notified_count,
        }

    except Exception as e:
        print(f"[Pipeline] ❌ Error: {e}")
        if current_run_id:
            try:
                log_agent(
                    cluster_id,
                    current_agent,
                    "failed",
                    "",
                    {"error": str(e)},
                    current_run_id,
                )
            except Exception:
                pass
        _sb().table("clusters").update({"status": "failed"}).eq("id", cluster_id).execute()
        return {"success": False, "error": str(e)}
