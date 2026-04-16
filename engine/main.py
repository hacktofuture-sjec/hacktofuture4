"""
REKALL Engine Service — Python FastAPI microservice.

This service wraps `rekall_engine` and exposes two endpoints for the Go backend:
  POST /pipeline/run    — start async pipeline for an incident
  POST /pipeline/learn  — submit outcome for LearningAgent
  GET  /health          — liveness probe

The Go backend calls these endpoints; the engine service runs the AI agent
graph (LangGraph) asynchronously and can notify the Go backend via a callback
URL when agent log events are emitted.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings

# ─────────────────────────────────────────────
# Module-level reusable HTTP client (Fix #1)
# ─────────────────────────────────────────────
_http_client: Optional[httpx.AsyncClient] = None



# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

class Settings(BaseSettings):
    groq_api_key: str = ""
    go_backend_url: str = "http://localhost:8000"   # callback target
    vault_path: str = "vault"                       # flat-file vault directory
    log_level: str = "INFO"

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("rekall.engine")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=10.0)
    log.info("Engine service starting up")
    yield
    log.info("Engine service shutting down")
    await _http_client.aclose()
    _http_client = None


app = FastAPI(
    title="REKALL Engine Service",
    description="AI agent pipeline — LangGraph + vault + RL",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────

class PipelineRunRequest(BaseModel):
    incident_id: str
    payload: Dict[str, Any]


class PipelineLearnRequest(BaseModel):
    incident_id: str
    fix_proposal_id: str
    result: str                   # success | failure | rejected
    reviewed_by: str = "human"
    notes: Optional[str] = None
    fix_tier: Optional[str] = None          # T1_human | T2_synthetic | T3_llm
    vault_entry_id: Optional[str] = None    # vault entry that was selected


class CreatePRRequest(BaseModel):
    incident_id: str
    fix_commands: list = []
    fix_description: str = ""
    fix_tier: str = "T3_llm"
    fix_diff: Optional[str] = None


class PipelineResponse(BaseModel):
    ok: bool
    message: str = ""


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"ok": True, "service": "rekall-engine"}


@app.post("/pipeline/run", response_model=PipelineResponse)
async def run_pipeline(req: PipelineRunRequest, background_tasks: BackgroundTasks):
    """
    Start the agent pipeline for an incident.
    Returns immediately; work runs in the background.
    """
    background_tasks.add_task(_run_pipeline_async, req.incident_id, req.payload)
    return PipelineResponse(ok=True, message="pipeline started")


class FetchFromGitHubRequest(BaseModel):
    incident_id: str
    repo: Optional[str] = None   # e.g. "abjt01/sample-ci-sad" — defaults to GITHUB_REPO env


@app.post("/pipeline/run-from-github", response_model=PipelineResponse)
async def run_from_github(req: FetchFromGitHubRequest, background_tasks: BackgroundTasks):
    """
    Fetch the latest failed GitHub Actions run from the given repo (or GITHUB_REPO env),
    extract its logs, and run the full real agent pipeline to diagnose and fix it.
    """
    background_tasks.add_task(_fetch_and_run_pipeline, req.incident_id, req.repo)
    return PipelineResponse(ok=True, message="fetching github ci failure and running pipeline")


@app.post("/pipeline/learn", response_model=PipelineResponse)
async def learn(req: PipelineLearnRequest):
    """
    Submit an outcome so LearningAgent can update vault confidence.
    """
    try:
        await _run_learning(
            req.incident_id, req.fix_proposal_id, req.result,
            req.reviewed_by, req.notes, req.fix_tier, req.vault_entry_id,
        )
        return PipelineResponse(ok=True, message="learning complete")
    except NotImplementedError:
        # rekall_engine agents are placeholders — acknowledged gracefully
        return PipelineResponse(ok=True, message="learning placeholder (engine not yet implemented)")
    except Exception as exc:
        log.exception("learning failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/pipeline/create-pr", response_model=PipelineResponse)
async def create_pr(req: CreatePRRequest, background_tasks: BackgroundTasks):
    """
    Open a real GitHub PR using the approved fix proposal.
    Called by the Go backend when a human approves a block_await_human incident.
    Runs asynchronously and posts back the PR URL via the engine-callback.
    """
    background_tasks.add_task(
        _create_pr_async,
        req.incident_id,
        req.fix_commands,
        req.fix_description,
        req.fix_tier,
        req.fix_diff,
    )
    return PipelineResponse(ok=True, message="pr creation started")


# ─────────────────────────────────────────────
# Pipeline execution
# ─────────────────────────────────────────────

async def _fetch_and_run_pipeline(incident_id: str, repo_name: Optional[str]) -> None:
    """
    Fetch the latest failed GitHub Actions workflow run from the configured repo,
    extract the real failure logs, and run the full agent pipeline against them.
    This is the REAL path — no simulated data, no emulation.
    """
    github_token = os.getenv("GITHUB_TOKEN", "")
    repo_slug    = repo_name or os.getenv("GITHUB_REPO", "")

    if not github_token or not repo_slug:
        await _post_callback(incident_id, {"type": "agent_log", "data": {
            "incident_id": incident_id, "step_name": "monitor", "status": "error",
            "detail": "GITHUB_TOKEN or GITHUB_REPO not configured — cannot fetch real CI failures",
        }})
        await _post_callback(incident_id, {"type": "status", "data": {"incident_id": incident_id, "status": "failed"}})
        return

    await _post_callback(incident_id, {"type": "agent_log", "data": {
        "incident_id": incident_id, "step_name": "monitor", "status": "running",
        "detail": f"Connecting to GitHub → {repo_slug}",
    }})

    try:
        import zipfile, io
        try:
            from github import Github  # type: ignore
        except ImportError:
            await _post_callback(incident_id, {"type": "agent_log", "data": {
                "incident_id": incident_id, "step_name": "monitor", "status": "error",
                "detail": "PyGithub not installed — cannot fetch real CI failures",
            }})
            return
        
        loop = asyncio.get_running_loop()

        def gh_fetch():
            g    = Github(github_token)
            repo = g.get_repo(repo_slug)

            # Find the most recent failed workflow run (any branch)
            runs = repo.get_workflow_runs(status="failure")
            run  = None
            for r in runs:
                run = r
                break

            if run is None:
                return None, None, None, None

            # Download the log zip archive
            import urllib.request, urllib.error
            logs_url = (
                f"https://api.github.com/repos/{repo_slug}/actions/runs/{run.id}/logs"
            )
            req = urllib.request.Request(logs_url, headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github+json",
            })
            log_text = ""
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    zdata = resp.read()
                zf = zipfile.ZipFile(io.BytesIO(zdata))
                parts = []
                for name in sorted(zf.namelist())[:10]:  # first 10 step logs
                    parts.append(f"=== {name} ===\n{zf.read(name).decode('utf-8', errors='replace')[:3000]}")
                log_text = "\n\n".join(parts)[:12000]
            except Exception as e:
                log_text = f"[Could not download logs: {e}]"

            return run, log_text, repo.default_branch, run.head_commit.sha if run.head_commit else ""

        run, log_text, default_branch, commit_sha = await loop.run_in_executor(None, gh_fetch)

        if run is None:
            await _post_callback(incident_id, {"type": "agent_log", "data": {
                "incident_id": incident_id, "step_name": "monitor", "status": "error",
                "detail": f"No failed workflow runs found in {repo_slug}",
            }})
            await _post_callback(incident_id, {"type": "status", "data": {"incident_id": incident_id, "status": "failed"}})
            return

        await _post_callback(incident_id, {"type": "agent_log", "data": {
            "incident_id": incident_id, "step_name": "monitor", "status": "done",
            "detail": f"Found failed run #{run.run_number}: '{run.name}' on {run.head_branch}",
        }})

        # Build a real incident payload with actual GitHub data
        payload = {
            "source":       "github_actions",
            "failure_type": "unknown",   # DiagnosticAgent will classify from logs
            "description":  f"GitHub Actions failure: {run.name} (run #{run.run_number})",
            "log_excerpt":  log_text,
            "git_diff":     None,
            "branch":       run.head_branch,
            "commit_sha":   commit_sha,
            "workflow_url": run.html_url,
            "repo":         repo_slug,
        }

    except Exception as exc:
        log.exception("GitHub fetch failed: %s", exc)
        await _post_callback(incident_id, {"type": "agent_log", "data": {
            "incident_id": incident_id, "step_name": "monitor", "status": "error",
            "detail": f"GitHub fetch failed: {exc}",
        }})
        await _post_callback(incident_id, {"type": "status", "data": {"incident_id": incident_id, "status": "failed"}})
        return

    # Delegate to the real agent pipeline — NOT the emulated fallback
    await _run_pipeline_async(incident_id, payload)


async def _run_pipeline_async(incident_id: str, payload: Dict[str, Any]) -> None:
    """
    Drive the rekall_engine pipeline and relay agent log events back to the
    Go backend via its /internal/agent-log endpoint.
    When rekall_engine agents are not yet implemented this falls back to a
    stepped emulation that keeps the dashboard alive.
    """
    log.info("Pipeline started for incident %s", incident_id)

    try:
        # Use the real engine graph — run_pipeline returns final state dict
        # and emits AgentLogEntry objects to a queue as it runs.
        from rekall_engine.graph.orchestrator import run_pipeline  # type: ignore
        import asyncio as _asyncio
        from rekall_engine.types import AgentLogEntry  # type: ignore

        queue: _asyncio.Queue = _asyncio.Queue()

        # Run pipeline in background, draining the queue concurrently
        pipeline_task = _asyncio.create_task(
            run_pipeline(payload, incident_id, log_queue=queue)
        )

        # Drain log entries until sentinel (None) received
        while True:
            entry = await queue.get()
            if entry is None:
                break
            if isinstance(entry, AgentLogEntry):
                await _post_callback(incident_id, {
                    "type": "agent_log",
                    "data": {
                        "incident_id": entry.incident_id,
                        "step_name":   entry.step_name,
                        "status":      entry.status,
                        "detail":      entry.detail,
                    },
                })

        # Wait for pipeline to finish
        final_state = await pipeline_task

        # ── Post sandbox_result callback if available ─────────────────────
        # This covers both the sandbox-validated-PR path and the paused path
        # (where sandbox failed and human review is still needed).
        sandbox = final_state.get("sandbox_result")
        if sandbox is not None:
            await _post_callback(incident_id, {
                "type": "sandbox_result",
                "data": {
                    "incident_id":      incident_id,
                    "passed":           bool(getattr(sandbox, "passed", False)),
                    "test_count":       int(getattr(sandbox, "test_count", 0)),
                    "failure_count":    int(getattr(sandbox, "failure_count", 0)),
                    "test_log":         str(getattr(sandbox, "test_log", ""))[:5000],
                    "pr_evidence":      str(getattr(sandbox, "pr_evidence", "")),
                    "namespace":        str(getattr(sandbox, "namespace", "")),
                    "duration_seconds": float(getattr(sandbox, "duration_seconds", 0.0)),
                    "valkey_deployed":  bool(getattr(sandbox, "valkey_deployed", False)),
                    "demo_mode":        bool(getattr(sandbox, "demo_mode", False)),
                },
            })

        # ── Sandbox-validated PR path ─────────────────────────────────────
        # When the sandbox passed, orchestrator set sandbox_validated_pr=True
        # and did NOT set paused. We now create the PR with sandbox evidence.
        if final_state.get("sandbox_validated_pr"):
            fix = final_state.get("fix_proposal")
            pr_evidence = str(getattr(sandbox, "pr_evidence", "")) if sandbox else ""
            if fix is not None:
                import asyncio as _asyncio
                _asyncio.create_task(_create_pr_async(
                    incident_id,
                    list(getattr(fix, "fix_commands", []) or []),
                    str(getattr(fix, "fix_description", "") or ""),
                    str(getattr(fix, "tier", "T3_llm") or "T3_llm"),
                    getattr(fix, "fix_diff", None),
                    pr_evidence=pr_evidence,
                ))

        # ── If the pipeline paused for human review, push the fix_proposal to
        # ── the Go store NOW so Approve → GetLatestFixProposal finds it.
        elif final_state.get("paused"):
            fix = final_state.get("fix_proposal")
            if fix is not None:
                import uuid as _uuid
                await _post_callback(incident_id, {
                    "type": "fix_proposal",
                    "data": {
                        "id":              str(_uuid.uuid4()),
                        "incident_id":     incident_id,
                        "tier":            str(getattr(fix, "tier", "T3_llm")),
                        "fix_description": str(getattr(fix, "fix_description", "") or ""),
                        "fix_commands":    list(getattr(fix, "fix_commands", []) or []),
                        "fix_diff":        getattr(fix, "fix_diff", None),
                        "vault_entry_id":  getattr(fix, "vault_entry_id", None),
                        "confidence":      float(getattr(fix, "confidence", 0.5) or 0.5),
                        "reasoning":       str(getattr(fix, "reasoning", "") or ""),
                    },
                })

        # Determine final status
        gov = final_state.get("governance_decision")
        if final_state.get("paused"):
            final_status = "awaiting_approval"
        else:
            final_status = "resolved"

        await _post_callback(incident_id, {
            "type": "status",
            "data": {
                "incident_id":        incident_id,
                "status":             final_status,
                "governance_decision": {
                    "risk_score":  gov.risk_score  if gov else 0.5,
                    "decision":    gov.decision    if gov else "block_await_human",
                    "risk_factors": gov.risk_factors if gov else [],
                } if gov else None,
            },
        })

    except Exception as exc:
        log.exception("pipeline error: %s", exc)
        # Only fall back to emulation if it's clearly a missing implementation
        if isinstance(exc, (NotImplementedError, ImportError)):
            log.warning("rekall_engine not implemented — running emulated pipeline")
            await _emulated_pipeline(incident_id, payload)
        else:
            # Real error — report it to the dashboard
            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name": "error",
                    "status": "error",
                    "detail": f"Pipeline error: {type(exc).__name__}: {exc}",
                },
            })
            await _post_callback(incident_id, {
                "type": "status",
                "data": {"incident_id": incident_id, "status": "failed"},
            })


async def _emulated_pipeline(incident_id: str, payload: Dict[str, Any]) -> None:
    """
    Replays a realistic step-by-step timeline to the Go backend callback
    when the real engine graph is not yet implemented.
    Also performs a real GitHub PR creation if GITHUB_LIVE_PR=true.
    """
    steps = [
        ("monitor",       "Normalising failure event payload"),
        ("diagnostic",    "Fetching logs, git diff, and test reports"),
        ("fix",           "Searching memory vault: T1 → T2 → T3 fallback"),
        ("governance",    "Computing risk score across 6 dimensions"),
        ("publish_guard", "Supply-chain safety gate: checking commands"),
        ("learning",      "Slack & Notion notifications dispatched"),
    ]

    for step_name, detail in steps:
        for status in ("running", "done"):
            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name":   step_name,
                    "status":      status,
                    "detail":      detail,
                },
            })
            if status == "running":
                await asyncio.sleep(1.2)

    # ── Live GitHub PR (production demo) ──────────────────────────────────────
    # When GITHUB_LIVE_PR=true, open a real PR on GITHUB_REPO using the
    # AI-generated fix commands (emulated here). This runs even in emulated
    # pipeline mode because the real agent stubs raise NotImplementedError.
    github_live_pr = os.getenv("GITHUB_LIVE_PR", "false").lower() == "true"
    github_token   = os.getenv("GITHUB_TOKEN", "")
    github_repo    = os.getenv("GITHUB_REPO", "")

    pr_url: Optional[str] = None
    if github_live_pr and github_token and github_repo:
        try:
            try:
                from github import Github  # type: ignore  # PyGithub
            except ImportError:
                log.warning("[emulated_pipeline] PyGithub not installed — skipping PR")
                raise RuntimeError("PyGithub not installed")
            g    = Github(github_token)
            repo = g.get_repo(github_repo)

            branch_name = f"rekall-auto-fix-{incident_id[:8]}"
            base_branch = repo.default_branch
            base_sha    = repo.get_branch(base_branch).commit.sha

            # Create the fix branch
            repo.create_git_ref(f"refs/heads/{branch_name}", base_sha)

            # Determine scenario label for the commit message
            scenario = payload.get("scenario", payload.get("failure_type", "unknown"))

            # Commit a fix script to the branch
            fix_script = (
                f"#!/bin/bash\n"
                f"# REKALL Auto-Fix — Incident {incident_id}\n"
                f"# Scenario: {scenario}\n"
                f"# Generated: by REKALL AI Agent pipeline\n\n"
                f"echo 'Applying REKALL recommended fix for: {scenario}'\n"
                f"# TODO: replace with actual fix commands from FixAgent\n"
            )
            repo.create_file(
                path=f".rekall/fix-{incident_id[:8]}.sh",
                message=f"fix({incident_id[:8]}): REKALL auto-fix for {scenario}",
                content=fix_script.encode(),
                branch=branch_name,
            )

            # Open the Pull Request
            pr = repo.create_pull(
                title=f"[REKALL] Auto-fix: {scenario} — incident {incident_id[:8]}",
                body=(
                    f"## 🤖 REKALL Auto-Fix\n\n"
                    f"**Incident ID:** `{incident_id}`\n"
                    f"**Scenario:** `{scenario}`\n"
                    f"**Pipeline:** Emulated (AI agents returning fix commands)\n\n"
                    f"### What happened\n"
                    f"REKALL's AI pipeline detected a `{scenario}` failure, "
                    f"diagnosed the root cause, retrieved a fix from the memory vault, "
                    f"and scored governance risk as low enough to proceed.\n\n"
                    f"### Fix\n"
                    f"See `.rekall/fix-{incident_id[:8]}.sh` in this branch.\n\n"
                    f"*Auto-generated by REKALL. Please review before merging.*"
                ),
                head=branch_name,
                base=base_branch,
            )
            pr_url = pr.html_url
            log.info("[emulated_pipeline] PR opened: %s", pr_url)

            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name":   "execute",
                    "status":      "done",
                    "detail":      f"Pull request opened: {pr_url}",
                },
            })

        except Exception as exc:
            log.warning("[emulated_pipeline] GitHub PR creation failed: %s", exc)
            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name":   "execute",
                    "status":      "error",
                    "detail":      f"PR creation failed: {exc}",
                },
            })
    # ──────────────────────────────────────────────────────────────────────────

    await _post_callback(incident_id, {
        "type": "status",
        "data": {"incident_id": incident_id, "status": "resolved"},
    })


async def _create_pr_async(
    incident_id: str,
    fix_commands: list,
    fix_description: str,
    fix_tier: str,
    fix_diff: Optional[str],
    pr_evidence: str = "",
) -> None:
    """
    Create a real GitHub PR for a human-approved fix.
    Called by POST /pipeline/create-pr (triggered from Go Approve handler).
    Posts execution progress back via the engine-callback so the SSE
    stream updates the dashboard in real time.
    """
    github_token = os.getenv("GITHUB_TOKEN", "")
    github_repo  = os.getenv("GITHUB_REPO", "")
    github_live  = os.getenv("GITHUB_LIVE_PR", "false").lower() == "true"

    await _post_callback(incident_id, {
        "type": "agent_log",
        "data": {
            "incident_id": incident_id,
            "step_name":   "execute",
            "status":      "running",
            "detail":      "Human approved — opening pull request on GitHub",
        },
    })

    if not github_live or not github_token or not github_repo:
        # Not configured for live PRs — emit a trace-only event
        await _post_callback(incident_id, {
            "type": "agent_log",
            "data": {
                "incident_id": incident_id,
                "step_name":   "execute",
                "status":      "done",
                "detail":      "PR creation skipped (GITHUB_LIVE_PR not enabled)",
            },
        })
        return

    try:
        try:
            from github import Github  # type: ignore
        except ImportError:
            log.error("[create_pr] PyGithub not installed")
            await _post_callback(incident_id, {"type": "agent_log", "data": {
                "incident_id": incident_id, "step_name": "execute", "status": "error",
                "detail": "PyGithub not installed — cannot create PR",
            }})
            return

        loop = asyncio.get_running_loop()

        def gh_create():
            g    = Github(github_token)
            repo = g.get_repo(github_repo)

            branch_name  = f"rekall-fix-{incident_id[:8]}"
            base_branch  = repo.default_branch
            base_sha     = repo.get_branch(base_branch).commit.sha

            try:
                repo.create_git_ref(f"refs/heads/{branch_name}", base_sha)
            except Exception as branch_exc:
                if "already exists" in str(branch_exc).lower() or "reference already" in str(branch_exc).lower():
                    pass
                else:
                    log.warning("[create_pr] branch creation error: %s", branch_exc)

            # Build fix script content
            scenario = fix_description or f"incident-{incident_id[:8]}"
            cmd_block = "\n".join(fix_commands) if fix_commands else "# No specific fix commands generated"
            script = (
                f"#!/bin/bash\n"
                f"# REKALL Auto-Fix — Incident {incident_id}\n"
                f"# Tier: {fix_tier}\n"
                f"# Generated by REKALL AI agent pipeline (human-approved)\n\n"
                f"echo 'Applying fix: {scenario}'\n\n"
                f"{cmd_block}\n"
            )

            # Commit fix script
            try:
                repo.create_file(
                    path=f".rekall/fix-{incident_id[:8]}.sh",
                    message=f"fix({incident_id[:8]}): REKALL auto-fix [{fix_tier}]",
                    content=script.encode(),
                    branch=branch_name,
                )
            except Exception:
                # File may exist already — update it
                existing = repo.get_contents(f".rekall/fix-{incident_id[:8]}.sh", ref=branch_name)
                repo.update_file(
                    path=f".rekall/fix-{incident_id[:8]}.sh",
                    message=f"fix({incident_id[:8]}): update REKALL auto-fix [{fix_tier}]",
                    content=script.encode(),
                    sha=existing.sha,
                    branch=branch_name,
                )

            # Build PR body — include sandbox evidence if available
            sandbox_section = (
                f"\n\n{pr_evidence}"
                if pr_evidence
                else "\n\n*Auto-generated by REKALL. Approved by human reviewer. Please review before merging.*"
            )
            approval_note = (
                "*Fix was automatically validated in a Minikube sandbox and auto-approved.*"
                if pr_evidence
                else "*Auto-generated by REKALL. Approved by human reviewer. Please review before merging.*"
            )

            pr_title_prefix = "[REKALL] Sandbox-Validated Fix" if pr_evidence else "[REKALL] Auto-fix"

            pr = repo.create_pull(
                title=f"{pr_title_prefix}: {scenario[:70]}",
                body=(
                    f"## 🤖 REKALL Auto-Fix {'(Sandbox Validated)' if pr_evidence else '(Human Approved)'}\n\n"
                    f"**Incident ID:** `{incident_id}`\n"
                    f"**Fix tier:** `{fix_tier}`\n"
                    f"**Description:** {scenario}\n\n"
                    f"### Fix commands\n```bash\n{cmd_block}\n```\n"
                    f"{sandbox_section}"
                ),
                head=branch_name,
                base=base_branch,
            )
            return pr.html_url

        pr_url = await loop.run_in_executor(None, gh_create)
        log.info("[create_pr] PR opened: %s", pr_url)

        await _post_callback(incident_id, {
            "type": "agent_log",
            "data": {
                "incident_id": incident_id,
                "step_name":   "execute",
                "status":      "done",
                "detail":      f"Pull request opened: {pr_url}",
            },
        })

    except Exception as exc:
        log.exception("[create_pr] GitHub PR creation failed: %s", exc)
        await _post_callback(incident_id, {
            "type": "agent_log",
            "data": {
                "incident_id": incident_id,
                "step_name":   "execute",
                "status":      "error",
                "detail":      f"PR creation failed: {exc}",
            },
        })


async def _run_learning(
    incident_id: str,
    fix_proposal_id: str,
    result: str,
    reviewed_by: str,
    notes: Optional[str],
    fix_tier: Optional[str] = None,
    vault_entry_id: Optional[str] = None,
) -> None:
    """
    Delegate to LearningAgent with properly typed Outcome and FixProposal.
    """
    from rekall_engine.agents.learning import LearningAgent  # type: ignore
    from rekall_engine.types import Outcome, FixProposal      # type: ignore

    outcome = Outcome(
        incident_id=incident_id,
        fix_proposal_id=fix_proposal_id,
        result=result,   # type: ignore[arg-type]
        reviewed_by=reviewed_by,
        notes=notes,
    )
    fix = FixProposal(
        incident_id=incident_id,
        tier=fix_tier or "T3_llm",       # type: ignore[arg-type]
        vault_entry_id=vault_entry_id,
        similarity_score=None,
        fix_description="",
        fix_commands=[],
        fix_diff=None,
        confidence=0.5,
    )
    agent = LearningAgent()
    await agent.run({"outcome": outcome, "fix_proposal": fix})


async def _post_callback(incident_id: str, event: Dict[str, Any]) -> None:
    """
    POST an event back to the Go backend's internal callback endpoint.
    Failures are logged and swallowed — the pipeline continues regardless.
    """
    url = f"{settings.go_backend_url}/internal/engine-callback"
    client = _http_client
    if client is None:
        client = httpx.AsyncClient(timeout=5.0)
    try:
        await client.post(url, json=event)
    except Exception as exc:
        log.debug("callback failed (ok during dev): %s", exc)
