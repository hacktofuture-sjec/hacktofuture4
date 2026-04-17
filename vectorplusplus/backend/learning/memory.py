"""
Learning Layer — stores fix outcomes and retrieves past successes to
give the Analyzer / Planner agents context about what has worked before.
"""
import json
from database.db import get_supabase


# ──────────────────────────────────────────────────────────────────────────────
# Write side — record outcome of a PR
# ──────────────────────────────────────────────────────────────────────────────

def record_fix_attempt(
    cluster_id: int,
    pr_url: str,
    branch_name: str,
    analysis: dict,
    plan: dict,
    patch_count: int,
    notified_users_count: int,
) -> str | None:
    """
    Persist a fix attempt to fix_outcomes immediately after the PR is created.
    Outcome starts as 'pending' and should be updated later via update_outcome().

    Returns:
        The UUID of the inserted fix_outcome row, or None on failure.
    """
    sb = get_supabase()
    try:
        result = (
            sb.table("fix_outcomes")
            .insert({
                "cluster_id": cluster_id,
                "pr_url": pr_url,
                "branch_name": branch_name,
                "outcome": "pending",
                "issue_type": analysis.get("issue_type"),
                "severity": analysis.get("severity"),
                "affected_area": analysis.get("affected_area"),
                "estimated_complexity": plan.get("estimated_complexity"),
                "patch_count": patch_count,
                "notified_users_count": notified_users_count,
                # Store snapshots as JSON for few-shot retrieval later
                "analysis_snapshot": json.dumps(analysis),
                "plan_snapshot": json.dumps(plan),
            })
            .execute()
        )
        row_id = result.data[0]["id"]
        print(f"[Learning] Recorded fix attempt {row_id} for cluster {cluster_id}")
        return row_id
    except Exception as e:
        print(f"[Learning] Error recording fix attempt: {e}")
        return None


def update_outcome(fix_outcome_id: str, outcome: str) -> None:
    """
    Update the outcome of a recorded fix (call this after polling GitHub PR state).

    Args:
        fix_outcome_id: UUID from fix_outcomes table
        outcome:        'merged' | 'rejected' | 'pending'
    """
    from datetime import datetime, timezone
    sb = get_supabase()
    try:
        sb.table("fix_outcomes").update({
            "outcome": outcome,
            "outcome_recorded_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", fix_outcome_id).execute()
        print(f"[Learning] Updated outcome for {fix_outcome_id} → {outcome}")
    except Exception as e:
        print(f"[Learning] Error updating outcome: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# Read side — retrieve similar successful fixes
# ──────────────────────────────────────────────────────────────────────────────

def get_similar_successful_fixes(
    issue_type: str,
    affected_area: str,
    limit: int = 3,
) -> list[dict]:
    """
    Retrieve past merged fixes that match the current issue type and area.
    Used to inject few-shot examples into Planner / Coder prompts.

    Returns:
        List of fix_outcome rows (with analysis_snapshot and plan_snapshot).
    """
    sb = get_supabase()
    try:
        results = (
            sb.table("fix_outcomes")
            .select("issue_type, severity, affected_area, analysis_snapshot, plan_snapshot, pr_url")
            .eq("outcome", "merged")
            .eq("issue_type", issue_type)
            .order("outcome_recorded_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = results.data or []

        # If no exact type match, fall back to area match
        if not rows:
            results = (
                sb.table("fix_outcomes")
                .select("issue_type, severity, affected_area, analysis_snapshot, plan_snapshot, pr_url")
                .eq("outcome", "merged")
                .ilike("affected_area", f"%{affected_area}%")
                .order("outcome_recorded_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = results.data or []

        print(f"[Learning] Found {len(rows)} similar successful fixes for type='{issue_type}'")
        return rows
    except Exception as e:
        print(f"[Learning] Error fetching similar fixes: {e}")
        return []


def build_learnings_context(issue_type: str, affected_area: str) -> str:
    """
    Build a formatted string of past successful fixes to inject into
    Analyzer / Planner prompts as few-shot context.

    Returns:
        Formatted string, or empty string if no past fixes found.
    """
    past_fixes = get_similar_successful_fixes(issue_type, affected_area)
    if not past_fixes:
        return ""

    lines = ["--- PAST SUCCESSFUL FIXES (for context) ---"]
    for i, fix in enumerate(past_fixes, 1):
        try:
            analysis = json.loads(fix.get("analysis_snapshot") or "{}")
            plan = json.loads(fix.get("plan_snapshot") or "{}")
            lines.append(
                f"\n[Fix #{i}]\n"
                f"  Issue: {analysis.get('issue_title', 'N/A')}\n"
                f"  Root Cause: {analysis.get('root_cause', 'N/A')}\n"
                f"  Fix Summary: {plan.get('summary', 'N/A')}\n"
                f"  Approach: {plan.get('approach', 'N/A')}\n"
                f"  PR: {fix.get('pr_url', 'N/A')}"
            )
        except Exception:
            continue

    return "\n".join(lines)
