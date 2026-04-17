"""
Vector++ FastAPI Backend
Autonomous Feedback-to-Fix Intelligence Platform
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from database.db import get_supabase
from ingestion.normalizer import save_feedback
from ingestion.reviews_scraper import generate_simulated_reviews, get_manual_override_review
from clustering.embedder import embed_feedback
from clustering.clusterer import cluster_feedback, recluster_all
from pipeline.orchestrator import run_pipeline
from learning.memory import update_outcome
from agency.api.routes import router as agency_router
from pydantic import BaseModel
from typing import Optional
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vector++",
    description="Autonomous Feedback-to-Fix Intelligence Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agency_router)

def _sb():
    """Get Supabase client (lazy) or raise a helpful HTTP error."""
    try:
        return get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "Supabase is not configured correctly. "
                "Set SUPABASE_URL and a valid SUPABASE_KEY (typically a service_role key) in .env. "
                f"Underlying error: {e}"
            ),
        )


# ── Request Models ────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    repo_name: str
    search_query: str
    max_github_issues: int = 50
    max_reddit_posts: int = 20
    reddit_subreddit: str = "programming"
    include_github: bool = True
    include_reddit: bool = True
    include_hackernews: bool = True
    include_twitter: bool = True
    strict_query_match: bool = False

class PipelineRequest(BaseModel):
    cluster_id: int
    repo_name: str

class ReclusterRequest(BaseModel):
    eps: float = 0.35
    min_samples: int = 2

class ClusterResetRequest(BaseModel):
    clear_agent_runs: bool = True
    target_status: str = "pending"

class OutcomeRequest(BaseModel):
    outcome: str  # 'merged' | 'rejected' | 'pending'


# ── Health & Stats ────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "Vector++ API running 🚀"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.get("/api/stats")
def get_stats():
    """Dashboard summary statistics."""
    try:
        sb = _sb()
        feedback = sb.table("feedback").select("id", count="exact").execute()
        clusters = sb.table("clusters").select("id", count="exact").execute()
        prs = sb.table("pull_requests").select("id", count="exact").execute()
        agents = sb.table("agent_runs").select("id", count="exact").execute()

        # Breakdown by status
        running = (
            sb.table("clusters")
            .select("id", count="exact")
            .eq("status", "running")
            .execute()
        )
        done = (
            sb.table("clusters")
            .select("id", count="exact")
            .eq("status", "done")
            .execute()
        )
        failed = (
            sb.table("clusters")
            .select("id", count="exact")
            .eq("status", "failed")
            .execute()
        )

        # Source breakdown
        github_count = (
            sb.table("feedback")
            .select("id", count="exact")
            .eq("source", "google_reviews")
            .execute()
        )
        reddit_count = (
            sb.table("feedback")
            .select("id", count="exact")
            .eq("source", "yelp")
            .execute()
        )

        # Learning layer stats
        merged_fixes = (
            sb.table("fix_outcomes")
            .select("id", count="exact")
            .eq("outcome", "merged")
            .execute()
        )
        rejected_fixes = (
            sb.table("fix_outcomes")
            .select("id", count="exact")
            .eq("outcome", "rejected")
            .execute()
        )

        return {
            "total_feedback": feedback.count or 0,
            "total_clusters": clusters.count or 0,
            "total_prs": prs.count or 0,
            "total_agent_runs": agents.count or 0,
            "clusters_running": running.count or 0,
            "clusters_done": done.count or 0,
            "clusters_failed": failed.count or 0,
            "feedback_by_source": {
                "google_reviews": github_count.count or 0,
                "yelp": reddit_count.count or 0,
            },
            "learnings": {
                "merged_fixes": merged_fixes.count or 0,
                "rejected_fixes": rejected_fixes.count or 0,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ── Feedback ──────────────────────────────────────────────────────────────────

@app.get("/api/feedback")
def get_feedback(limit: int = 100, source: Optional[str] = None):
    """Get all feedback, optionally filtered by source."""
    sb = _sb()
    query = sb.table("feedback").select("*").order("created_at", desc=True).limit(limit)
    if source:
        query = query.eq("source", source)
    return query.execute().data


@app.get("/api/feedback/{feedback_id}")
def get_feedback_item(feedback_id: str):
    sb = _sb()
    result = sb.table("feedback").select("*").eq("id", feedback_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result.data[0]


# ── Clusters ──────────────────────────────────────────────────────────────────

@app.get("/api/clusters")
def get_clusters():
    """Get all clusters sorted by priority."""
    sb = _sb()
    return (
        sb.table("clusters")
        .select("*")
        .order("priority_score", desc=True)
        .execute()
        .data
    )

@app.get("/api/clusters/{cluster_id}")
def get_cluster(cluster_id: int):
    sb = _sb()
    result = sb.table("clusters").select("*").eq("id", cluster_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return result.data[0]

@app.get("/api/clusters/{cluster_id}/feedback")
def get_cluster_feedback(cluster_id: int):
    """Get all feedback items belonging to a cluster."""
    sb = _sb()
    return (
        sb.table("feedback")
        .select("*")
        .eq("cluster_id", cluster_id)
        .execute()
        .data
    )

@app.get("/api/clusters/{cluster_id}/agents")
def get_agent_runs(cluster_id: int):
    """Get agent run timeline for a cluster (used by dashboard)."""
    sb = _sb()
    return (
        sb.table("agent_runs")
        .select("*")
        .eq("cluster_id", cluster_id)
        .order("started_at")
        .execute()
        .data
    )


# ── Pull Requests ─────────────────────────────────────────────────────────────

@app.get("/api/prs")
def get_prs():
    """Get all generated pull requests."""
    sb = _sb()
    return (
        sb.table("pull_requests")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )


@app.get("/api/prs/{pr_id}")
def get_pr(pr_id: str):
    """Get a single pull request by ID."""
    sb = _sb()
    result = sb.table("pull_requests").select("*").eq("id", pr_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="PR not found")
    return result.data[0]


@app.post("/api/prs/{pr_id}/outcome")
def record_pr_outcome(pr_id: str, req: OutcomeRequest):
    """
    Record whether a PR was merged or rejected so the learning layer
    can improve future fix suggestions.
    Allowed outcome values: 'merged' | 'rejected' | 'pending'
    """
    allowed = {"merged", "rejected", "pending"}
    if req.outcome not in allowed:
        raise HTTPException(status_code=422, detail=f"outcome must be one of {allowed}")

    sb = _sb()
    # Update PR status
    sb.table("pull_requests").update({"status": req.outcome}).eq("id", pr_id).execute()

    # Update learning record if it exists
    pr_row = sb.table("pull_requests").select("*").eq("id", pr_id).execute()
    if pr_row.data:
        pr = pr_row.data[0]
        cluster_id = pr.get("cluster_id")
        if cluster_id:
            outcome_rows = (
                sb.table("fix_outcomes")
                .select("id")
                .eq("cluster_id", cluster_id)
                .execute()
            )
            for row in outcome_rows.data or []:
                update_outcome(row["id"], req.outcome)

    return {"status": "updated", "pr_id": pr_id, "outcome": req.outcome}


@app.get("/api/learnings")
def get_learnings(limit: int = 20, outcome: Optional[str] = None):
    """Get fix outcome records for the learning dashboard."""
    sb = _sb()
    query = (
        sb.table("fix_outcomes")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if outcome:
        query = query.eq("outcome", outcome)
    return query.execute().data


# ── Actions ───────────────────────────────────────────────────────────────────

@app.post("/api/ingest")
def ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger full ingestion pipeline:
    GitHub + Reddit + (optionally) Twitter/HN → embed → cluster
    """
    def _ingest():
        try:
            items = []
            client_name = req.repo_name or "Unknown Client"

            # If a query is provided and strict match is requested, use manual override.
            if req.strict_query_match and req.search_query:
                items += get_manual_override_review(client_name, req.search_query)
            else:
                # Add default reviews
                if req.include_github:  # Mapped to 'Google Reviews' in UI
                    google_reviews = generate_simulated_reviews(client_name)
                    items += [r for r in google_reviews if r['source'] == 'google_reviews']
                
                if req.include_reddit:  # Mapped to 'Yelp' in UI
                    yelp_reviews = generate_simulated_reviews(client_name)
                    items += [r for r in yelp_reviews if r['source'] == 'yelp']

            count = save_feedback(items)
            embed_feedback()
            cluster_feedback(min_samples=1)
            logger.info(f"Ingest complete: {count} new items for {client_name}")
        except Exception as e:
            logger.error(f"Ingest error: {e}")

    background_tasks.add_task(_ingest)
    return {"status": "started", "message": "Ingestion running in background"}


@app.post("/api/cluster/reset")
def reset_clusters(req: ReclusterRequest):
    """Re-cluster all feedback with new parameters."""
    count = recluster_all(eps=req.eps, min_samples=req.min_samples)
    return {"status": "done", "clusters_created": count}


@app.post("/api/pipeline/run")
def run(req: PipelineRequest, background_tasks: BackgroundTasks):
    """Trigger the 4-agent pipeline for a specific cluster (non-blocking)."""
    def _run():
        try:
            result = run_pipeline(req.cluster_id, req.repo_name)
            logger.info(f"Pipeline result for cluster {req.cluster_id}: {result}")
        except Exception as e:
            logger.error(f"Pipeline error for cluster {req.cluster_id}: {e}")

    background_tasks.add_task(_run)
    return {"status": "started", "cluster_id": req.cluster_id}


@app.delete("/api/feedback")
def clear_feedback():
    """Delete all feedback (dev only)."""
    sb = _sb()
    sb.table("feedback").delete().neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    return {"status": "cleared"}


@app.delete("/api/clusters")
def clear_clusters():
    """Delete all clusters, dependent records, and unlink feedback from clusters."""
    try:
        sb = _sb()
        # Remove dependent records first to satisfy FK constraints.
        sb.table("agent_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        try:
            sb.table("fix_outcomes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception:
            pass # ignore if table doesn't exist yet

        sb.table("pull_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        sb.table("feedback").update({"cluster_id": None, "status": "raw"}).neq(
            "id", "00000000-0000-0000-0000-000000000000"
        ).execute()
        
        sb.table("clusters").delete().neq("id", -1).execute()
        return {"status": "cleared"}
    except Exception as e:
        import traceback
        logger.error(f"Error clearing clusters: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/clusters/{cluster_id}/reset")
def reset_cluster(cluster_id: int, req: ClusterResetRequest):
    """
    Reset a cluster so pipeline can be rerun after a crash/stuck state.
    """
    sb = _sb()
    if req.clear_agent_runs:
        sb.table("agent_runs").delete().eq("cluster_id", cluster_id).execute()
    sb.table("clusters").update({"status": req.target_status}).eq("id", cluster_id).execute()
    return {"status": "reset", "cluster_id": cluster_id, "target_status": req.target_status}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
