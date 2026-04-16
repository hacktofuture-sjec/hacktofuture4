"""
PipelineMedic — intended flow:

  CI fails → POST log here → LLM/rules analyze → if high-confidence fixable (auto_fix),
  apply patch + open GitHub PR when GITHUB_TOKEN is set → Telegram + console notify
  (message includes PR link when a PR was opened).

Env: GROQ_API_KEY, TELEGRAM_*, GITHUB_* (token required for real PRs).
Optional: LANGFUSE_* for LLM observability and cost tracking (Groq generations).
CI: POST { "repository", "log" | "log_text" } to /webhook.
"""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import requests
from dotenv import load_dotenv
from langfuse import Langfuse
from langfuse.types import TraceContext
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

# --- Langfuse (optional: LLM cost / usage tracking) -------------------------------

_langfuse_client: Langfuse | None = None
_langfuse_init_done: bool = False


def _get_langfuse() -> Langfuse | None:
    """Returns client when LANGFUSE_SECRET_KEY + LANGFUSE_PUBLIC_KEY are set; else None."""
    global _langfuse_client, _langfuse_init_done
    if _langfuse_init_done:
        return _langfuse_client
    _langfuse_init_done = True
    sk = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    pk = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    if not sk or not pk:
        return None
    host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com").strip()
    _langfuse_client = Langfuse(
        secret_key=sk,
        public_key=pk,
        host=host or "https://cloud.langfuse.com",
    )
    return _langfuse_client


def _langfuse_flush() -> None:
    lf = _get_langfuse()
    if lf is None:
        return
    try:
        lf.flush()
    except Exception as e:
        print(f"[PipelineMedic] Langfuse flush failed: {e}", flush=True)


def _groq_usage_to_usage_details(usage: dict[str, Any]) -> dict[str, int]:
    pt = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    ct = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    tt = int(usage.get("total_tokens") or (pt + ct))
    return {
        "prompt_tokens": pt,
        "completion_tokens": ct,
        "total_tokens": tt,
    }


# --- Groq + rule-based analysis -------------------------------------------------

DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SYSTEM_PROMPT = """You are a senior engineer diagnosing a failed CI run after a code push.
Respond with ONLY valid JSON, no markdown, with keys:
root_cause (string): one or two sentences — what failed and why.
fix (string): concrete steps the developer should take (commands, file edits, or checks).
confidence (number 0-1), risk ("LOW" or "HIGH"),
fixable (boolean): true only if a safe automated patch is realistic (e.g. missing dep in requirements.txt).
file (string): primary file to change, or empty string.

Be conservative: fixable true mainly for clear dependency / import / manifest issues."""


def _rule_based_analysis(log_text: str) -> dict[str, Any]:
    lower = log_text.lower()
    m = re.search(r"No module named ['\"]([^'\"]+)['\"]", log_text, re.IGNORECASE)
    if not m:
        m = re.search(
            r"ModuleNotFoundError:\s*No module named\s+([A-Za-z_][A-Za-z0-9_.]*)",
            log_text,
            re.IGNORECASE,
        )
    mod = m.group(1).strip() if m else None
    if mod:
        pkg = mod.split(".")[0]
        return {
            "root_cause": f"Missing Python package/module: {mod}",
            "fix": f"Add `{pkg}` to requirements.txt (or install in CI) and pin a version if needed.",
            "confidence": 0.75,
            "risk": "LOW",
            "fixable": True,
            "file": "requirements.txt",
        }
    if "pip: command not found" in lower or "pip: not found" in lower:
        return {
            "root_cause": "pip not available in CI environment",
            "fix": "Ensure Python/pip is installed in the workflow or use a setup action.",
            "confidence": 0.55,
            "risk": "HIGH",
            "fixable": False,
            "file": "",
        }
    if "error: failed to solve" in lower or "could not find a version" in lower:
        return {
            "root_cause": "Dependency resolution failure",
            "fix": "Check version constraints in requirements.txt / lockfile.",
            "confidence": 0.6,
            "risk": "HIGH",
            "fixable": True,
            "file": "requirements.txt",
        }
    return {
        "root_cause": "Unclassified CI failure (rule-based fallback)",
        "fix": "Inspect the full log near the error lines and reproduce locally.",
        "confidence": 0.35,
        "risk": "HIGH",
        "fixable": False,
        "file": "",
    }


def _normalize_analysis(raw: dict[str, Any]) -> dict[str, Any]:
    risk = str(raw.get("risk", "HIGH")).upper()
    if risk not in ("LOW", "HIGH"):
        risk = "HIGH"
    try:
        conf = float(raw.get("confidence", 0))
    except (TypeError, ValueError):
        conf = 0.0
    conf = max(0.0, min(1.0, conf))
    return {
        "root_cause": str(raw.get("root_cause", "")).strip() or "Unknown",
        "fix": str(raw.get("fix", "")).strip() or "No suggestion",
        "confidence": conf,
        "risk": risk,
        "fixable": bool(raw.get("fixable", False)),
        "file": str(raw.get("file", "") or ""),
    }


def _parse_json_content(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z]*\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


def analyze_log(
    log_text: str,
    *,
    repository: str | None = None,
) -> tuple[dict[str, Any], str]:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        print("[PipelineMedic] GROQ_API_KEY is empty — using rule-based analysis", flush=True)
        return _normalize_analysis(_rule_based_analysis(log_text)), "rules"

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip()
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    base_body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Analyze this CI log excerpt:\n\n{log_text[:12000]}"},
        ],
        "temperature": 0.2,
    }

    lf = _get_langfuse()
    trace_id: str | None = None
    if lf is not None:
        try:
            trace_id = lf.create_trace_id()
        except Exception as e:
            print(f"[PipelineMedic] Langfuse create_trace_id failed: {e}", flush=True)
            lf = None

    def _call_groq(with_json_object: bool, attempt_label: str) -> tuple[dict[str, Any], str]:
        body = {**base_body}
        if with_json_object:
            body["response_format"] = {"type": "json_object"}
        gen = None
        if lf is not None and trace_id is not None:
            try:
                mp: dict[str, Any] = {"temperature": body.get("temperature", 0.2)}
                if with_json_object:
                    mp["response_format"] = "json_object"
                gen = lf.start_observation(
                    trace_context=TraceContext(trace_id=trace_id),
                    as_type="generation",
                    name="groq_chat_completion",
                    model=model,
                    model_parameters=mp,
                    input=body.get("messages"),
                    metadata={
                        "attempt": attempt_label,
                        "repository": (repository or "")[:200],
                        "provider": "groq",
                    },
                )
            except Exception as e:
                print(f"[PipelineMedic] Langfuse start_observation failed: {e}", flush=True)

        try:
            r = requests.post(GROQ_URL, headers=headers, json=body, timeout=60)
            r.raise_for_status()
            data = r.json()
            msg = data["choices"][0]["message"]["content"]
            parsed = _parse_json_content(msg)
            norm = _normalize_analysis(parsed)
            if gen is not None:
                try:
                    usage_raw = data.get("usage") if isinstance(data.get("usage"), dict) else {}
                    ud = _groq_usage_to_usage_details(usage_raw)
                    gen.update(output=norm, usage_details=ud)
                except Exception as e:
                    print(f"[PipelineMedic] Langfuse generation update failed: {e}", flush=True)
            return norm, "groq"
        except Exception as e:
            if gen is not None:
                try:
                    gen.update(
                        level="ERROR",
                        status_message=str(e)[:500],
                    )
                except Exception:
                    pass
            raise
        finally:
            if gen is not None:
                try:
                    gen.end()
                except Exception as e:
                    print(f"[PipelineMedic] Langfuse generation end failed: {e}", flush=True)

    try:
        return _call_groq(True, "json_object")
    except Exception as e1:
        try:
            return _call_groq(False, "plain")
        except Exception as e2:
            print(
                f"[PipelineMedic] Groq failed (json_object: {e1!r}; retry: {e2!r}) — using rules",
                flush=True,
            )
            return _normalize_analysis(_rule_based_analysis(log_text)), "rules"


# --- Decision -------------------------------------------------------------------

DecisionPath = Literal["auto_fix", "notify_only"]


def extract_error_line(log_text: str, max_len: int = 500) -> str:
    lines = log_text.strip().splitlines()
    patterns = (
        r"No module named",
        r"ModuleNotFoundError",
        r"ImportError",
        r"cannot import name",
        r"pip install",
        r"ERROR",
        r"Error:",
    )
    for line in lines:
        s = line.strip()
        if not s:
            continue
        for p in patterns:
            if re.search(p, s, re.IGNORECASE):
                return s[:max_len]
    for line in reversed(lines):
        s = line.strip()
        if s and ("error" in s.lower() or "failed" in s.lower()):
            return s[:max_len]
    joined = " ".join(lines[-5:]) if lines else ""
    return (joined or log_text)[:max_len]


def decide(analysis: dict[str, Any]) -> DecisionPath:
    fixable = bool(analysis.get("fixable"))
    try:
        conf = float(analysis.get("confidence", 0))
    except (TypeError, ValueError):
        conf = 0.0
    if fixable and conf > 0.7:
        return "auto_fix"
    return "notify_only"


# --- Notifications --------------------------------------------------------------

def _parse_telegram_chat_id(raw: str) -> int | str:
    """Telegram accepts int chat ids; groups are often negative (-100...)."""
    s = raw.strip()
    if s.lstrip("-").isdigit():
        return int(s)
    return s


def _telegram_chat_ids() -> list[int | str]:
    """Comma-separated TELEGRAM_CHAT_ID: DM + group, etc."""
    raw = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not raw:
        return []
    return [_parse_telegram_chat_id(x) for x in raw.split(",") if x.strip()]


def _telegram_configured() -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chats = _telegram_chat_ids()
    enabled = os.getenv("TELEGRAM_ENABLED", "true").strip().lower() == "true"
    return bool(token and chats and enabled)


def _clip(text: str, max_len: int) -> str:
    t = text.strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1].rstrip() + "…"


def _github_notify_block(github_info: dict[str, Any] | None, decision: str) -> str:
    """Human-readable PR outcome for Telegram/console."""
    if decision != "auto_fix":
        return (
            "— Automated fix / PR —\n"
            "Skipped (notify_only): confidence too low or not safely auto-fixable.\n\n"
        )
    if not github_info:
        return "— Automated fix / PR —\nNot attempted.\n\n"
    if github_info.get("ok") and github_info.get("mode") == "github":
        url = str(github_info.get("html_url", ""))
        num = github_info.get("pull_number")
        branch = github_info.get("branch", "")
        return (
            "— Automated fix / PR —\n"
            f"Opened PR #{num} on branch `{branch}`\n"
            f"{url}\n"
            "Review and merge manually (no auto-merge).\n\n"
        )
    if github_info.get("mode") == "mock":
        msg = github_info.get("message", "skipped")
        return (
            "— Automated fix / PR —\n"
            f"Not created: {msg}\n"
            "Set GITHUB_TOKEN (repo scope) + target repo to open a real PR.\n\n"
        )
    err = github_info.get("error", str(github_info))
    return f"— Automated fix / PR —\nFailed: {err}\n\n"


def build_notification_message(
    repository: str,
    decision: str,
    analysis: dict[str, Any],
    source: str,
    log_excerpt: str,
    github_info: dict[str, Any] | None = None,
    for_telegram: bool = False,
) -> str:
    """Telegram: full story + short Meta (decision + confidence only). Console: + risk + analysis source."""
    src = "Groq LLM" if source == "groq" else "rule-based fallback (no GROQ_API_KEY or API error)"
    route = (
        "auto_fix — patch proposed; PR opened when GitHub is configured."
        if decision == "auto_fix"
        else "notify_only — review diagnosis and fix manually."
    )
    target = (analysis.get("file") or "").strip()
    target_line = f"Likely file: {target}\n\n" if target else ""
    conf = analysis.get("confidence")

    body = (
        "PipelineMedic · CI failed after a push\n\n"
        f"Repository: {repository}\n\n"
        "— Error signal (from CI log) —\n"
        f"{_clip(log_excerpt, 900)}\n\n"
        "— Diagnosis —\n"
        f"{_clip(str(analysis.get('root_cause', '')), 1200)}\n\n"
        "— Suggested fix —\n"
        f"{_clip(str(analysis.get('fix', '')), 1200)}\n\n"
        f"{_github_notify_block(github_info, decision)}"
        f"{target_line}"
        "— Routing —\n"
        f"{route}\n"
    )
    if for_telegram:
        return (
            body
            + "\n\n— Meta —\n"
            f"Decision: {decision}\n"
            f"Confidence: {conf}\n"
        )
    return (
        body
        + "\n\n— Meta —\n"
        f"Decision: {decision}\n"
        f"Confidence: {conf} · Risk: {analysis.get('risk')}\n"
        f"Analysis source: {src}"
    )


def notify_console_mock_slack(
    repository: str,
    decision: str,
    analysis: dict[str, Any],
    source: str,
    log_excerpt: str,
    github_info: dict[str, Any] | None = None,
) -> None:
    print("\n--- Mock Slack block ---")
    print(
        build_notification_message(
            repository,
            decision,
            analysis,
            source,
            log_excerpt,
            github_info,
            for_telegram=False,
        )
    )
    print("--- End mock Slack ---\n")


def notify_telegram(
    repository: str,
    decision: str,
    analysis: dict[str, Any],
    source: str,
    log_excerpt: str,
    github_info: dict[str, Any] | None = None,
) -> None:
    if not _telegram_configured():
        return
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_ids = _telegram_chat_ids()
    text = build_notification_message(
        repository,
        decision,
        analysis,
        source,
        log_excerpt,
        github_info,
        for_telegram=True,
    )
    # Telegram hard limit 4096 characters for a single message
    text = _clip(text, 4000)
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    for chat_id in chat_ids:
        try:
            r = requests.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
                timeout=15,
            )
            r.raise_for_status()
        except Exception as e:
            print(f"[PipelineMedic] Telegram send failed (chat_id={chat_id}): {e}")


def mock_pipeline_rerun(decision: str) -> None:
    if decision == "auto_fix":
        print(
            "[PipelineMedic] Mock: triggering pipeline re-run (print only) — would POST to CI provider"
        )


# --- Memory ---------------------------------------------------------------------

MAX_ENTRIES = 200


def append_incident(
    repository: str,
    log_excerpt: str,
    analysis: dict[str, Any],
    decision_path: str,
) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "repository": repository,
        "log_excerpt": log_excerpt,
        "analysis": analysis,
        "decision_path": decision_path,
    }
    for path in (Path("data") / "failures.json", Path("/tmp") / "pipelinemedic_failures.json"):
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            entries: list[Any] = []
            if path.exists():
                try:
                    raw = path.read_text(encoding="utf-8")
                    entries = json.loads(raw) if raw.strip() else []
                except (json.JSONDecodeError, OSError):
                    entries = []
            if not isinstance(entries, list):
                entries = []
            entries.append(record)
            if len(entries) > MAX_ENTRIES:
                entries = entries[-MAX_ENTRIES:]
            path.write_text(json.dumps(entries, indent=2), encoding="utf-8")
            return
        except OSError:
            continue


# --- GitHub ---------------------------------------------------------------------

GITHUB_API = "https://api.github.com"


def _gh_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def resolve_repo_slug(
    repository: str,
    repository_full_name: str | None,
) -> tuple[str | None, str | None]:
    if repository_full_name and "/" in repository_full_name.strip():
        parts = repository_full_name.strip().split("/", 1)
        return parts[0], parts[1]
    r = repository.strip()
    if "/" in r:
        a, b = r.split("/", 1)
        return a, b
    owner = os.getenv("GITHUB_DEFAULT_OWNER", "").strip()
    if owner:
        return owner, r
    return None, None


def _get_default_branch(token: str, owner: str, repo: str) -> str | None:
    r = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_gh_headers(token), timeout=30)
    if r.status_code != 200:
        return None
    return r.json().get("default_branch")


def _get_file_sha(token: str, owner: str, repo: str, path: str, ref: str) -> str | None:
    r = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers=_gh_headers(token),
        params={"ref": ref},
        timeout=30,
    )
    if r.status_code != 200:
        return None
    return r.json().get("sha")


def _create_branch(
    token: str, owner: str, repo: str, base_branch: str, new_branch: str
) -> tuple[bool, str | None]:
    ref_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{base_branch}"
    r = requests.get(ref_url, headers=_gh_headers(token), timeout=30)
    if r.status_code != 200:
        return False, f"Could not read base ref {base_branch}: {r.status_code}"
    sha = r.json().get("object", {}).get("sha")
    if not sha:
        return False, "Missing base commit SHA"
    create = requests.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/refs",
        headers=_gh_headers(token),
        json={"ref": f"refs/heads/{new_branch}", "sha": sha},
        timeout=30,
    )
    if create.status_code == 201:
        return True, None
    if create.status_code == 422 and "already exists" in (create.text or "").lower():
        return True, None
    return False, f"Create branch failed: {create.status_code} {create.text}"


def _put_file(
    token: str,
    owner: str,
    repo: str,
    path: str,
    branch: str,
    content: str,
    message: str,
    file_sha: str | None,
) -> tuple[bool, str | None]:
    body: dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
        "branch": branch,
    }
    if file_sha:
        body["sha"] = file_sha
    r = requests.put(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers=_gh_headers(token),
        json=body,
        timeout=30,
    )
    if r.status_code in (200, 201):
        return True, None
    return False, f"Update file failed: {r.status_code} {r.text}"


def _open_pr(
    token: str,
    owner: str,
    repo: str,
    title: str,
    body: str,
    head: str,
    base: str,
) -> tuple[int | None, str | None]:
    r = requests.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
        headers=_gh_headers(token),
        json={"title": title, "body": body, "head": head, "base": base},
        timeout=30,
    )
    if r.status_code == 201:
        num = r.json().get("number")
        return int(num) if num is not None else None, None
    return None, f"Open PR failed: {r.status_code} {r.text}"


def _request_reviewers(
    token: str, owner: str, repo: str, pr_number: int, reviewers: list[str]
) -> None:
    if not reviewers:
        return
    requests.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}/requested_reviewers",
        headers=_gh_headers(token),
        json={"reviewers": reviewers},
        timeout=30,
    )


def maybe_create_autofix_pr(
    repository: str,
    repository_full_name: str | None,
    analysis: dict[str, Any],
    decision: str,
) -> dict[str, Any]:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    base_branch = os.getenv("GITHUB_BASE_BRANCH", "main").strip() or "main"

    if not token:
        return {
            "ok": False,
            "mode": "mock",
            "message": "GITHUB_TOKEN not set; skipping real PR",
        }

    owner, repo = resolve_repo_slug(repository, repository_full_name)
    if not owner or not repo:
        return {
            "ok": False,
            "mode": "error",
            "error": "Could not resolve owner/repo (set GITHUB_DEFAULT_OWNER for short repo names)",
        }

    if decision != "auto_fix":
        return {"ok": False, "mode": "mock", "message": "notify_only path — no PR"}

    target_file = (analysis.get("file") or "").strip() or "requirements.txt"
    fix_text = str(analysis.get("fix", ""))
    if target_file.endswith("requirements.txt") or target_file.endswith(".txt"):
        pkg_line = "# pipelinemedic autofix — review before merge\n"
        m = re.search(r"`([^`]+)`", fix_text)
        extra = f"{m.group(1)}\n" if m else ""
        new_content = pkg_line + extra
    else:
        new_content = f"# pipelinemedic autofix\n# {fix_text[:500]}\n"

    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    branch_name = f"pipelinemedic/autofix-{ts}"

    def_branch = _get_default_branch(token, owner, repo)
    if not def_branch:
        return {
            "ok": False,
            "mode": "error",
            "error": "Repository not accessible or empty (needs initial commit)",
        }
    use_base = base_branch if base_branch else def_branch

    ok_b, err_b = _create_branch(token, owner, repo, use_base, branch_name)
    if not ok_b:
        return {"ok": False, "mode": "error", "error": err_b or "branch error"}

    file_sha = _get_file_sha(token, owner, repo, target_file, branch_name)
    if file_sha:
        get_c = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{target_file}",
            headers=_gh_headers(token),
            params={"ref": branch_name},
            timeout=30,
        )
        if get_c.status_code == 200:
            cur = base64.b64decode(get_c.json()["content"]).decode("utf-8", errors="replace")
            new_content = cur.rstrip() + "\n" + new_content

    ok_f, err_f = _put_file(
        token,
        owner,
        repo,
        target_file,
        branch_name,
        new_content,
        f"chore: PipelineMedic autofix ({target_file})",
        file_sha,
    )
    if not ok_f:
        return {"ok": False, "mode": "error", "error": err_f or "file update error"}

    title = f"PipelineMedic autofix: {analysis.get('root_cause', 'CI fix')[:80]}"
    pr_body = (
        f"Automated suggestion (review required).\n\n"
        f"**Root cause:** {analysis.get('root_cause')}\n\n"
        f"**Fix:** {analysis.get('fix')}\n"
    )
    pr_num, err_p = _open_pr(token, owner, repo, title, pr_body, branch_name, use_base)
    if pr_num is None:
        return {"ok": False, "mode": "error", "error": err_p or "PR error"}

    reviewers_raw = os.getenv("GITHUB_PR_REVIEWERS", "").strip()
    reviewers = [x.strip() for x in reviewers_raw.split(",") if x.strip()]
    _request_reviewers(token, owner, repo, pr_num, reviewers)

    html_url = f"https://github.com/{owner}/{repo}/pull/{pr_num}"
    return {
        "ok": True,
        "mode": "github",
        "pull_number": pr_num,
        "html_url": html_url,
        "branch": branch_name,
        "base": use_base,
    }


# --- FastAPI --------------------------------------------------------------------

app = FastAPI(title="PipelineMedic", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def health_payload() -> dict[str, Any]:
    # GET / does not call Groq — these flags only show whether env vars are present (for Vercel debugging).
    return {
        "status": "ok",
        "service": "pipelinemedic",
        "version": "1.0.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "telegram_configured": bool(
            os.getenv("TELEGRAM_BOT_TOKEN", "").strip() and _telegram_chat_ids()
        ),
        "github_token_configured": bool(os.getenv("GITHUB_TOKEN", "").strip()),
        "langfuse_configured": bool(
            os.getenv("LANGFUSE_SECRET_KEY", "").strip()
            and os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
        ),
    }


@app.get("/")
async def root_get():
    return health_payload()


@app.get("/webhook")
@app.get("/api/webhook")
async def webhook_get():
    return health_payload()


async def _parse_body(request: Request) -> dict[str, Any]:
    try:
        return await request.json()
    except Exception:
        return {}


def _get_log_text(body: dict[str, Any]) -> str | None:
    if "log" in body and body["log"] is not None:
        return str(body["log"])
    if "log_text" in body and body["log_text"] is not None:
        return str(body["log_text"])
    return None


async def process_webhook(request: Request) -> JSONResponse:
    body = await _parse_body(request)
    repository = body.get("repository")
    log_text = _get_log_text(body)
    repository_full_name = body.get("repository_full_name")

    if not repository:
        return JSONResponse(
            status_code=400,
            content={"detail": "Missing required field: repository"},
        )
    if log_text is None or not str(log_text).strip():
        return JSONResponse(
            status_code=400,
            content={"detail": "Missing required field: log or log_text"},
        )

    repo_str = str(repository).strip()
    log_str = str(log_text)

    try:
        analysis, source = analyze_log(log_str, repository=repo_str)
        decision = decide(analysis)
        log_excerpt = extract_error_line(log_str)

        # Error → (if auto_fix) apply patch + open PR on GitHub → then notify with PR link
        github_info: dict[str, Any] = {}
        try:
            github_info = maybe_create_autofix_pr(
                repo_str,
                str(repository_full_name).strip() if repository_full_name else None,
                analysis,
                decision,
            )
        except Exception as e:
            github_info = {"ok": False, "mode": "error", "error": str(e)}

        if decision == "auto_fix":
            mock_pipeline_rerun(decision)

        notify_console_mock_slack(
            repo_str, decision, analysis, source, log_excerpt, github_info
        )
        notify_telegram(repo_str, decision, analysis, source, log_excerpt, github_info)

        try:
            append_incident(repo_str, log_excerpt, analysis, decision)
        except Exception:
            pass

        out: dict[str, Any] = {
            "status": "processed",
            "repository": repo_str,
            "decision": decision,
            "analysis": analysis,
            "analysis_source": source,
        }
        if github_info:
            out["github"] = github_info
        return JSONResponse(status_code=200, content=out)
    finally:
        _langfuse_flush()


@app.post("/webhook")
@app.post("/api/webhook")
async def webhook_post(request: Request):
    return await process_webhook(request)


@app.post("/")
async def root_post(request: Request):
    return await process_webhook(request)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000)
