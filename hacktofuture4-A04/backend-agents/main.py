"""
main.py — The Heart
FastAPI server with quota-aware rate limiting for Gemini free tier.

FREE TIER BUDGET (gemini-2.5-flash-lite):
  15 requests/minute (RPM)
  1 500 requests/day

QUOTA MANAGEMENT STRATEGY:
  - Each full workflow uses ~6 LLM calls (2 per agent × 3 agents).
  - Daily budget: 1500 ÷ 6 = 250 full workflow runs per day.
  - RPM limit: minimum 4 seconds between any two LLM calls.
  - AUTO-POLL is OFF by default — set AUTO_POLL=true in .env to enable.
  - When poll is on, interval is 300s (5 min) to stay safe within daily budget.
  - Circuit breaker: after 3 consecutive 429 errors, pause for 60 seconds.
"""

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from agents import AGENTS

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("self-healing-cloud")

session_service = InMemorySessionService()
APP_NAME = "self-healing-cloud"
USER_ID = "system" 
healing_log: list[dict[str, Any]] = []

_last_llm_call_at: float = 0.0     
_consecutive_429s: int   = 0       
_circuit_open_until: float = 0.0   

MIN_SECONDS_BETWEEN_CALLS = float(os.getenv("MIN_SECONDS_BETWEEN_CALLS", "4"))
CIRCUIT_BREAK_PAUSE       = int(os.getenv("CIRCUIT_BREAK_PAUSE", "60"))
MAX_CONSECUTIVE_429S      = int(os.getenv("MAX_CONSECUTIVE_429S", "3"))

AUTO_POLL         = os.getenv("AUTO_POLL", "false").lower() == "true"
POLL_INTERVAL     = int(os.getenv("POLL_INTERVAL_SECONDS", "300"))  



async def _quota_gate():
    """
    Enforces minimum spacing between LLM calls and circuit-breaker pause.
    Call this before every run_agent invocation.
    """
    global _last_llm_call_at, _circuit_open_until

    if time.time() < _circuit_open_until:
        wait = round(_circuit_open_until - time.time(), 1)
        log.warning(f"[QUOTA] Circuit open — waiting {wait}s before next LLM call")
        await asyncio.sleep(wait)

    elapsed = time.time() - _last_llm_call_at
    if elapsed < MIN_SECONDS_BETWEEN_CALLS:
        gap = MIN_SECONDS_BETWEEN_CALLS - elapsed
        log.debug(f"[QUOTA] Rate gate — sleeping {gap:.1f}s")
        await asyncio.sleep(gap)

    _last_llm_call_at = time.time()


async def run_agent(agent_name: str, user_message: str, session_id: str) -> str:
    """
    Run one ADK agent turn with quota protection.
    """
    global _consecutive_429s, _circuit_open_until

    await _quota_gate()

    agent = AGENTS[agent_name]
    
    try:
        await session_service.create_session(
            session_id=session_id,
            app_name=APP_NAME,
            user_id="system"
        )
    except Exception:
        pass

    runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=session_service
    )

    message = types.Content(role="user", parts=[types.Part(text=user_message)])

    for attempt in range(3):
        try:
            final = ""
            
            async for event in runner.run_async(
                session_id=session_id,
                user_id="system",
                new_message=message
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    final = event.content.parts[0].text

            _consecutive_429s = 0
            return final

        except Exception as exc:
            err_str = str(exc)

            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                _consecutive_429s += 1
                log.warning(f"[QUOTA] 429 on attempt {attempt+1}/3 for {agent_name}.")

                if _consecutive_429s >= MAX_CONSECUTIVE_429S:
                    _circuit_open_until = time.time() + CIRCUIT_BREAK_PAUSE
                    log.error(f"[QUOTA] Circuit breaker opened.")

                retry_delay = 30.0
                if "retry in" in err_str.lower():
                    try:
                        part = err_str.lower().split("retry in")[1].strip()
                        retry_delay = float(part.split("s")[0].strip())
                        retry_delay = max(retry_delay, 5.0)
                    except Exception:
                        pass

                if attempt < 2:
                    log.info(f"[QUOTA] Waiting {retry_delay}s before retry...")
                    await asyncio.sleep(retry_delay)
                    _last_llm_call_at = time.time()
                    continue
                else:
                    raise RuntimeError(f"Gemini 429 after 3 attempts.") from exc

            log.error(f"[AGENT ERROR] {agent_name}: {err_str}")
            raise

    return ""


async def healing_workflow(trigger: str = "manual") -> dict[str, Any]:
    """
    3-stage workflow: Monitor → Heal → Validate.
    Short-circuits after Monitor if cluster is healthy (saves 4 LLM calls).
    """
    session_id = f"session-{int(time.time())}"
    started_at = time.time()
    log.info(f"[WORKFLOW START] trigger={trigger} session={session_id}")

    audit: dict[str, Any] = {
        "session_id": session_id,
        "trigger":    trigger,
        "started_at": started_at,
        "stages":     {},
        "outcome":    "unknown",
        "escalate":   False,
        "duration_s": 0,
        "llm_calls":  0,
        "error":      None,
    }

    try:
        log.info("[STAGE 1] monitor_agent — Prometheus scan...")
        monitor_raw  = await run_agent(
            "monitor",
            "Scan all services for anomalies. Use get_anomalous_services first. "
            "If no anomalies, stop immediately and return anomalies_found:false.",
            session_id,
        )
        audit["llm_calls"] += 1
        monitor_data = _parse_json(monitor_raw)
        audit["stages"]["monitor"] = monitor_data
        log.info(f"[STAGE 1 DONE] anomalies_found={monitor_data.get('anomalies_found')}")

        if not monitor_data.get("anomalies_found", False):
            audit["outcome"]    = "healthy"
            audit["duration_s"] = round(time.time() - started_at, 1)
            healing_log.append(audit)
            log.info(f"[WORKFLOW END] healthy — {audit['llm_calls']} LLM calls used")
            return audit

        log.info("[STAGE 2] heal_agent — ArgoCD remediation...")
        heal_raw  = await run_agent(
            "heal",
            "Remediate these anomalies via ArgoCD:\n" + json.dumps(monitor_data),
            session_id,
        )
        audit["llm_calls"] += 1
        heal_data = _parse_json(heal_raw)
        audit["stages"]["heal"] = heal_data
        log.info(f"[STAGE 2 DONE] remediations={len(heal_data.get('remediations', []))}")

        log.info("[STAGE 3] validation_agent — LitmusChaos validation...")
        validation_raw = await run_agent(
            "validation",
            "Validate these heals with chaos experiments:\n" + json.dumps(heal_data),
            session_id,
        )
        audit["llm_calls"] += 1
        validation_data = _parse_json(validation_raw)
        audit["stages"]["validation"] = validation_data
        log.info(f"[STAGE 3 DONE] overall_status={validation_data.get('overall_status')}")

        audit["outcome"]    = validation_data.get("overall_status", "UNKNOWN")
        audit["escalate"]   = validation_data.get("escalate", False)
        audit["duration_s"] = round(time.time() - started_at, 1)
        healing_log.append(audit)

        log.info(
            f"[WORKFLOW END] {audit['outcome']} — "
            f"{audit['llm_calls']} LLM calls, {audit['duration_s']}s elapsed"
        )
        return audit

    except Exception as exc:
        audit["outcome"]    = "error"
        audit["escalate"]   = True
        audit["error"]      = str(exc)
        audit["duration_s"] = round(time.time() - started_at, 1)
        healing_log.append(audit)
        log.exception(f"[WORKFLOW ERROR] {exc}")
        raise


def _parse_json(text: str) -> dict[str, Any]:
    """Extract JSON from LLM response, handling markdown fences."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text}



_poll_task: asyncio.Task | None = None


async def _autonomous_loop():
    log.info(
        f"[POLL LOOP] Starting — interval={POLL_INTERVAL}s  "
        f"(~{1500 // max(6, 1)} max runs/day on free tier)"
    )
    while True:
        await asyncio.sleep(POLL_INTERVAL)
        try:
            await healing_workflow(trigger="auto-poll")
        except Exception as exc:
            log.exception(f"[POLL LOOP ERROR] {exc}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    global _poll_task
    log.info("Self-healing cloud server starting...")
    log.info(f"  Model: gemini-2.5-flash-lite (free tier: 1500 req/day, 15 RPM)")
    log.info(f"  Auto-poll: {'ON every ' + str(POLL_INTERVAL) + 's' if AUTO_POLL else 'OFF — use POST /trigger to run'}")
    if AUTO_POLL:
        _poll_task = asyncio.create_task(_autonomous_loop())
    yield
    if _poll_task:
        _poll_task.cancel()
    log.info("Server shutdown.")


app = FastAPI(
    title="Self-Healing Cloud",
    description="Autonomous K8s ops — Prometheus + Loki + Grafana → ADK (gemini-2.5-flash-lite) → ArgoCD + LitmusChaos",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class TriggerRequest(BaseModel):
    reason: str = "manual trigger"

class AgentQueryRequest(BaseModel):
    agent:  str
    prompt: str

class PromQLRequest(BaseModel):
    query:   str
    minutes: int = 10

class ChaosInjectRequest(BaseModel):
    experiment_name:  str = "demo-chaos"
    target_namespace: str = "staging"
    target_app:       str = "frontend"
    chaos_type:       str = "pod-delete"



@app.get("/health")
async def health():
    """Liveness probe + quota status."""
    now = time.time()
    circuit_status = "open" if now < _circuit_open_until else "closed"
    return {
        "status":           "ok",
        "model":            "gemini-2.5-flash-lite",
        "free_tier":        True,
        "auto_poll":        AUTO_POLL,
        "poll_interval_s":  POLL_INTERVAL,
        "circuit_breaker":  circuit_status,
        "consecutive_429s": _consecutive_429s,
        "agents":           list(AGENTS.keys()),
    }


@app.post("/trigger")
async def trigger_async(req: TriggerRequest, background_tasks: BackgroundTasks):
    """Trigger full workflow asynchronously (returns immediately)."""
    background_tasks.add_task(healing_workflow, trigger=req.reason)
    return {"message": "Workflow triggered", "session_id": f"manual-{int(time.time())}"}


@app.post("/trigger/sync")
async def trigger_sync(req: TriggerRequest):
    """Trigger and wait for full result. Best for testing and demos."""
    return await healing_workflow(trigger=req.reason)


@app.get("/logs")
async def get_logs(limit: int = 20):
    return {"total": len(healing_log), "entries": healing_log[-limit:]}


@app.get("/logs/{session_id}")
async def get_log(session_id: str):
    entry = next((e for e in healing_log if e["session_id"] == session_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")
    return entry


@app.get("/status")
async def cluster_status():
    """
    Lightweight cluster snapshot — bypasses the LLM to save free-tier quota.
    """
    from tools import get_anomalous_services
    try:
        data = get_anomalous_services(10)
        return {"snapshot": data}
    except Exception as e:
        return {"snapshot": {"error": str(e), "total_anomalous": 0, "services": []}}


@app.post("/agent/query")
async def agent_query(req: AgentQueryRequest):
    """Direct agent query. Uses 1-2 LLM calls — use sparingly on free tier."""
    if req.agent not in AGENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent. Choose from: {list(AGENTS.keys())}",
        )
    session_id = f"adhoc-{int(time.time())}"
    response   = await run_agent(req.agent, req.prompt, session_id)
    return {"agent": req.agent, "response": response}


@app.post("/metrics/query")
async def query_metrics(req: PromQLRequest):
    """
    Direct PromQL query — bypasses agents entirely, uses ZERO LLM calls.
    Use this for the dashboard live charts instead of /status.
    """
    from tools import _prometheus_client
    try:
        with _prometheus_client() as client:
            resp = client.get("/api/v1/query", params={"query": req.query})
            resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Prometheus error: {exc}")


@app.get("/quota")
async def quota_status():
    """
    Real-time quota usage summary.
    Helps you track how many LLM calls you've used today.
    """
    total_llm_calls = sum(e.get("llm_calls", 0) for e in healing_log)
    remaining_est   = max(0, 1500 - total_llm_calls)
    return {
        "model":                "gemini-2.5-flash-lite",
        "free_tier_daily_limit": 1500,
        "llm_calls_this_session": total_llm_calls,
        "estimated_remaining":   remaining_est,
        "workflows_run":         len(healing_log),
        "avg_calls_per_workflow": round(total_llm_calls / max(1, len(healing_log)), 1),
        "circuit_breaker":       "open" if time.time() < _circuit_open_until else "closed",
        "consecutive_429s":      _consecutive_429s,
        "tip": (
            "Use POST /metrics/query for dashboard charts — it uses 0 LLM calls. "
            "Reserve /trigger for actual healing events."
        ),
    }


@app.post("/chaos/inject")
async def chaos_inject(req: ChaosInjectRequest):
    """
    Inject a LitmusChaos fault into the cluster.
    After calling this, trigger /trigger/sync to let agents auto-heal.
    """
    from tools import run_chaos_experiment
    result = run_chaos_experiment(
        experiment_name=req.experiment_name,
        target_namespace=req.target_namespace,
        target_app=req.target_app,
        chaos_type=req.chaos_type,
    )
    return result


@app.get("/chaos/status/{run_id}")
async def chaos_status(run_id: str):
    """Poll result of a running LitmusChaos experiment by run_id."""
    from tools import get_chaos_result
    return get_chaos_result(run_id)


@app.get("/stream/monitor")
async def stream_monitor():
    """
    SSE stream of monitor results.
    NOTE: Each push uses 1-2 LLM calls. Interval is 300s on free tier.
    """
    stream_interval = max(300, POLL_INTERVAL) 

    async def generate():
        while True:
            try:
                result = await run_agent(
                    "monitor",
                    "Quick health scan — get_anomalous_services only.",
                    f"stream-{int(time.time())}",
                )
                yield f"data: {result}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            await asyncio.sleep(stream_interval)

    return StreamingResponse(generate(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=False, log_level="info")