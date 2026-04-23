"""
PipelineMedic — intended flow:

  CI fails → POST log here → LLM/rules analyze → if high-confidence fixable (auto_fix),
  apply patch + open GitHub PR when GITHUB_TOKEN is set → Telegram + console notify
  (message includes PR link when a PR was opened).

Env: GROQ_API_KEY, TELEGRAM_*, GITHUB_* (token required for real PRs).
Optional: LANGFUSE_* for LLM observability and cost tracking (Groq generations).
CI: POST { "repository", "log" | "log_text" } to /webhook.
GitHub: configure a repo Webhook (push) → POST /github/webhook for Telegram push alerts.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
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
  confidence (number 0-1)
  risk ("LOW" or "HIGH")
  fixable (boolean): true if a small, surgical patch can be produced
    automatically and safely. This includes (a) missing dependency in
    requirements.txt / package.json, (b) clear single-line logic bugs that
    a failing test points at (e.g. wrong operator, off-by-one, wrong
    constant), (c) obvious typos, (d) import fixes. Set false only when
    the failure needs broader design changes, data migrations, or info the
    log does not contain.
  file (string): the PRIMARY SOURCE file to patch. When a pytest/jest
    failure exercises an application module (e.g. test_app.py imports
    and exercises app.py), return the APPLICATION SOURCE file (app.py),
    NOT the test file. Return "" only if you cannot name the file with
    confidence.

Be decisive but careful. Prefer fixable=true when you can name the exact
file and the exact one-line or few-line change."""


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


def generate_fix_content(
    current_content: str,
    file_path: str,
    analysis: dict[str, Any],
    repository: str,
    log_excerpt: str | None = None,
    *,
    strict: bool = False,
    sandbox_feedback: str | None = None,
) -> str | None:
    """Ask Groq to produce the full patched content for `file_path`.

    Returns the new file content, or None if the call fails or the
    response is unusable. When ``strict`` is True the prompt is
    reinforced — useful as a second-chance attempt when the first
    return was unchanged or rejected. When ``sandbox_feedback`` is
    provided (the trimmed pytest output from a previous failed
    verification), it is injected into the prompt so the model can
    self-correct based on the real failure.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    base_rules = (
        "You are a senior engineer producing a minimal, surgical code fix. "
        "You will be given (1) the current full content of a source file, "
        "(2) a short failure analysis describing the root cause and the fix, "
        "and (3) an excerpt of the failing CI log. "
        "Return ONLY the ENTIRE new file content with the fix applied — no "
        "prose, no markdown fences, no explanations. Preserve every unrelated "
        "line, comment, import, blank line, and trailing newline exactly as in "
        "the input. Change only what the fix requires. Never delete code you "
        "do not understand."
    )
    if strict:
        base_rules += (
            " IMPORTANT: on the previous attempt you returned content "
            "identical to the input. That is wrong — the file has a bug "
            "that MUST be changed. Identify the exact offending "
            "token/operator/literal (for example a wrong arithmetic "
            "operator, wrong comparison, wrong constant, missing import, "
            "off-by-one) and change only that. You MUST return a file "
            "that differs from the input by at least one character."
        )
    system_prompt = base_rules

    user_payload = (
        f"Repository: {repository}\n"
        f"File: {file_path}\n\n"
        "=== CURRENT FILE CONTENT ===\n"
        f"{current_content}\n"
        "=== END FILE CONTENT ===\n\n"
        f"Failure root cause: {analysis.get('root_cause', '')}\n"
        f"Suggested fix: {analysis.get('fix', '')}\n"
        f"Likely file: {analysis.get('file', '')}\n"
    )
    if log_excerpt:
        user_payload += f"\n=== CI LOG EXCERPT ===\n{log_excerpt[:1500]}\n=== END LOG ===\n"
    if sandbox_feedback:
        user_payload += (
            "\n=== PREVIOUS SANDBOX VERIFICATION FAILED ===\n"
            "Your last attempted patch was executed against an auto-generated "
            "regression test inside an ephemeral Vercel Sandbox and the test "
            "did NOT pass. The relevant pytest output is below. Use it to "
            "produce a CORRECT patch this time.\n"
            f"{sandbox_feedback[:1800]}\n"
            "=== END SANDBOX VERIFICATION ===\n"
        )
    user_payload += "\nReturn the ENTIRE new file content (all lines) with the fix applied."

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ],
        "temperature": 0.0,
    }

    lf = _get_langfuse()
    trace_id: str | None = None
    if lf is not None:
        try:
            trace_id = lf.create_trace_id()
        except Exception:
            lf = None

    gen = None
    if lf is not None and trace_id is not None:
        try:
            gen = lf.start_observation(
                trace_context=TraceContext(trace_id=trace_id),
                as_type="generation",
                name="groq_fix_synthesis",
                model=model,
                model_parameters={"temperature": 0.0},
                input=body["messages"],
                metadata={
                    "repository": repository[:200],
                    "file": file_path[:200],
                    "provider": "groq",
                },
            )
        except Exception as e:
            print(f"[PipelineMedic] Langfuse fix-synthesis start failed: {e}", flush=True)

    try:
        r = requests.post(GROQ_URL, headers=headers, json=body, timeout=90)
        r.raise_for_status()
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        new_content = _strip_code_fences(content)
        if gen is not None:
            try:
                usage_raw = data.get("usage") if isinstance(data.get("usage"), dict) else {}
                gen.update(
                    output=new_content[:4000],
                    usage_details=_groq_usage_to_usage_details(usage_raw),
                )
            except Exception as e:
                print(f"[PipelineMedic] Langfuse fix-synthesis update failed: {e}", flush=True)
        return new_content
    except Exception as e:
        print(f"[PipelineMedic] Groq fix synthesis failed: {e}", flush=True)
        if gen is not None:
            try:
                gen.update(level="ERROR", status_message=str(e)[:500])
            except Exception:
                pass
        return None
    finally:
        if gen is not None:
            try:
                gen.end()
            except Exception as e:
                print(f"[PipelineMedic] Langfuse fix-synthesis end failed: {e}", flush=True)


def generate_regression_test(
    old_content: str,
    new_content: str,
    analysis: dict[str, Any],
    repository: str,
    source_file: str,
    existing_test_content: str | None = None,
) -> str | None:
    """Ask Groq to write a pytest regression test for the applied fix.

    The test must FAIL against ``old_content`` and PASS against
    ``new_content``. Returns only the test code (imports + function),
    ready to append into an existing test module, or None on failure.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    system_prompt = (
        "You are a senior engineer writing a minimal, self-contained "
        "pytest regression test. You will be shown (1) the BUGGY version "
        "of a source file, (2) the FIXED version, and (3) a short "
        "failure analysis. Produce ONE pytest function that would FAIL "
        "against the BUGGY version and PASS against the FIXED version. "
        "Requirements: "
        "(a) Name the function test_<snake_case>_regression. "
        "(b) Put any needed imports at the very top. Assume the file "
        "already imports pytest; do NOT re-import it. "
        "(c) If the source is a FastAPI app exposing `app`, use "
        "`from fastapi.testclient import TestClient` + `from app import app`. "
        "(d) Keep the test under 20 lines. No setup fixtures beyond "
        "those Python stdlib + FastAPI already provide. "
        "(e) Return ONLY Python code — no markdown fences, no prose, no "
        "explanatory comments beyond a single docstring line."
    )

    existing_hint = (
        "=== EXISTING TEST FILE (for context; do not repeat its imports) ===\n"
        f"{existing_test_content or '(none)'}\n"
        "=== END EXISTING TEST FILE ===\n\n"
    )

    user_payload = (
        f"Repository: {repository}\n"
        f"Source file: {source_file}\n\n"
        "=== BUGGY VERSION ===\n"
        f"{old_content}\n"
        "=== END BUGGY VERSION ===\n\n"
        "=== FIXED VERSION ===\n"
        f"{new_content}\n"
        "=== END FIXED VERSION ===\n\n"
        + existing_hint
        + f"Failure root cause: {analysis.get('root_cause', '')}\n"
        f"Fix summary: {analysis.get('fix', '')}\n\n"
        "Return ONLY the Python code for the new regression test."
    )

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ],
        "temperature": 0.0,
    }

    lf = _get_langfuse()
    trace_id: str | None = None
    gen = None
    if lf is not None:
        try:
            trace_id = lf.create_trace_id()
            gen = lf.start_observation(
                trace_context=TraceContext(trace_id=trace_id),
                as_type="generation",
                name="groq_test_synthesis",
                model=model,
                model_parameters={"temperature": 0.0},
                input=body["messages"],
                metadata={
                    "repository": repository[:200],
                    "source_file": source_file[:200],
                    "provider": "groq",
                },
            )
        except Exception as e:
            print(f"[PipelineMedic] Langfuse test-synthesis start failed: {e}", flush=True)
            gen = None

    try:
        r = requests.post(GROQ_URL, headers=headers, json=body, timeout=90)
        r.raise_for_status()
        data = r.json()
        raw = data["choices"][0]["message"]["content"]
        code = _strip_code_fences(raw).strip()
        if gen is not None:
            try:
                usage_raw = data.get("usage") if isinstance(data.get("usage"), dict) else {}
                gen.update(
                    output=code[:4000],
                    usage_details=_groq_usage_to_usage_details(usage_raw),
                )
            except Exception as e:
                print(f"[PipelineMedic] Langfuse test-synthesis update failed: {e}", flush=True)
        if not code or "def test_" not in code:
            return None
        return code
    except Exception as e:
        print(f"[PipelineMedic] Groq test synthesis failed: {e}", flush=True)
        if gen is not None:
            try:
                gen.update(level="ERROR", status_message=str(e)[:500])
            except Exception:
                pass
        return None
    finally:
        if gen is not None:
            try:
                gen.end()
            except Exception as e:
                print(f"[PipelineMedic] Langfuse test-synthesis end failed: {e}", flush=True)


_TEST_FN_RE = re.compile(r"^\s*def\s+(test_\w+)\s*\(", re.MULTILINE)


def _parse_test_name(test_code: str) -> str | None:
    m = _TEST_FN_RE.search(test_code or "")
    return m.group(1) if m else None


def _derive_test_path(source_path: str) -> str:
    """app.py -> tests/test_app.py ; src/foo/bar.py -> tests/test_bar.py."""
    base = source_path.rstrip("/").split("/")[-1]
    if not base.endswith(".py"):
        base = base + ".py"
    if not base.startswith("test_"):
        base = "test_" + base
    return f"tests/{base}"


def _merge_test_into_file(existing: str | None, new_test_code: str) -> str:
    """Append the generated test to an existing test module, or create one."""
    header = "# --- PipelineMedic regression tests (auto-generated) ---\n"
    snippet = new_test_code.strip() + "\n"
    if not existing or not existing.strip():
        return (
            "import pytest  # noqa: F401\n\n"
            f"{header}\n"
            f"{snippet}"
        )
    merged = existing.rstrip() + "\n\n\n" + header + "\n" + snippet
    return merged


# --- Vercel Sandbox self-verification ------------------------------------------
#
# After the LLM generates a fix + regression test, we spin up a fresh Firecracker
# microVM via the Vercel Sandbox Python SDK, drop both files in, pip-install the
# runtime deps, and execute the generated pytest. The PR is only marked as
# "pre-verified" if pytest exits 0. A failure does not block the PR — the human
# still sees it — but it is surfaced loudly so the reviewer knows the AI's own
# test did not yet pass. Every run is Langfuse-traced as a span so cost/latency
# is observable alongside the three Groq generations.

# The sandbox test harness always needs these, regardless of what the
# target repo declares. pytest drives the run; httpx is required by
# fastapi.testclient (the most common shape of generated test).
_SANDBOX_TEST_HARNESS_REQUIREMENTS = ("pytest", "httpx")
# Fallback used when the target repo has no requirements.txt at all.
_DEFAULT_SANDBOX_REQUIREMENTS = "fastapi\npydantic\nrequests\nhttpx\npytest\n"


def _merge_requirements(repo_requirements: str | None) -> str:
    """Combine the target repo's requirements.txt with the test harness deps.

    We never drop the repo's own pins (they describe the real runtime) but
    we add pytest/httpx if they are missing so the test harness can actually
    execute. Comments and blank lines are preserved.
    """
    if not repo_requirements or not repo_requirements.strip():
        return _DEFAULT_SANDBOX_REQUIREMENTS

    existing_names: set[str] = set()
    for raw_line in repo_requirements.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        # Strip any version/extras/markers to get the bare package name.
        name = re.split(r"[\s=<>!~;\[]", line, maxsplit=1)[0].lower()
        if name:
            existing_names.add(name)

    extras: list[str] = []
    for dep in _SANDBOX_TEST_HARNESS_REQUIREMENTS:
        if dep.lower() not in existing_names:
            extras.append(dep)

    merged = repo_requirements.rstrip() + "\n"
    if extras:
        merged += "# --- PipelineMedic sandbox test harness ---\n"
        merged += "\n".join(extras) + "\n"
    return merged


def _vercel_sandbox_credentials_present() -> bool:
    """True when the Vercel SDK has enough env to authenticate (token or OIDC)."""
    if os.getenv("VERCEL_OIDC_TOKEN", "").strip():
        return True
    return bool(
        os.getenv("VERCEL_TOKEN", "").strip()
        and os.getenv("VERCEL_TEAM_ID", "").strip()
        and os.getenv("VERCEL_PROJECT_ID", "").strip()
    )


def _tail(text: str, max_chars: int) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return "…(truncated)…\n" + text[-max_chars:]


_VERIFIED_BADGE = {
    "passed": ("✅", "Pre-verified in Vercel Sandbox"),
    "failed": ("⚠️", "Sandbox verification failed"),
    "errored": ("⚠️", "Sandbox verification errored"),
    "skipped": ("➖", "Sandbox skipped"),
}


def verify_patch_in_vercel_sandbox(
    *,
    source_path: str,
    source_content: str,
    test_path: str,
    test_content: str,
    test_name: str | None,
    repository: str,
    incident_token: str,
    repo_requirements: str | None = None,
) -> dict[str, Any]:
    """Run the AI-generated fix + regression test in an ephemeral Vercel Sandbox.

    Returns a verdict dict; never raises. Verdict values:
      - "passed"   pytest exit_code == 0
      - "failed"   pytest ran but returned non-zero (test caught something)
      - "errored"  could not even run pytest (pip install failed, SDK error…)
      - "skipped"  no sandbox credentials available in the environment

    The return shape is stable — callers can surface it in Telegram and PR bodies.
    """
    import time as _time

    started_at = _time.monotonic()
    verdict: dict[str, Any] = {
        "verdict": "skipped",
        "reason": "",
        "runtime": os.getenv("PM_SANDBOX_RUNTIME", "python3.13").strip() or "python3.13",
        "sandbox_id": None,
        "exit_code": None,
        "duration_ms": 0,
        "stdout_tail": "",
        "test_name": test_name,
        "test_path": test_path,
        "source_path": source_path,
    }

    if not _vercel_sandbox_credentials_present():
        verdict["reason"] = "no VERCEL_* credentials"
        return verdict

    try:
        from vercel.sandbox import Sandbox, WriteFile
    except Exception as import_err:
        verdict["verdict"] = "errored"
        verdict["reason"] = f"vercel SDK import failed: {import_err!r}"[:300]
        return verdict

    try:
        timeout_ms = int(os.getenv("PM_SANDBOX_TIMEOUT_MS", "240000"))
    except ValueError:
        timeout_ms = 240_000

    lf = _get_langfuse()
    span = None
    trace_id: str | None = None
    if lf is not None:
        try:
            trace_id = lf.create_trace_id()
            span = lf.start_observation(
                trace_context=TraceContext(trace_id=trace_id),
                as_type="span",
                name="vercel_sandbox_verify",
                input={
                    "repository": repository[:200],
                    "source_path": source_path,
                    "test_path": test_path,
                    "test_name": test_name,
                    "incident_token": incident_token,
                    "runtime": verdict["runtime"],
                },
                metadata={"provider": "vercel-sandbox"},
            )
        except Exception as e:
            print(f"[PipelineMedic] Langfuse sandbox span start failed: {e}", flush=True)
            span = None

    box = None
    try:
        box = Sandbox.create(runtime=verdict["runtime"], timeout=timeout_ms)
        verdict["sandbox_id"] = box.sandbox_id

        src_rel = source_path.lstrip("/")
        test_rel = test_path.lstrip("/")

        sandbox_requirements = _merge_requirements(repo_requirements)
        files: list[dict[str, Any]] = [
            WriteFile(path=src_rel, content=source_content.encode("utf-8")),
            WriteFile(path=test_rel, content=test_content.encode("utf-8")),
            WriteFile(
                path="requirements-sandbox.txt",
                content=sandbox_requirements.encode("utf-8"),
            ),
        ]
        # pytest resolves `tests/` as a package when __init__.py is present;
        # harmless otherwise, and required for some import styles.
        if "/" in test_rel:
            pkg_dir = test_rel.rsplit("/", 1)[0]
            files.append(WriteFile(path=f"{pkg_dir}/__init__.py", content=b""))
        box.write_files(files)

        install = box.run_command(
            "pip",
            ["install", "-q", "--disable-pip-version-check", "-r", "requirements-sandbox.txt"],
        )
        install_out = (install.stdout() or "") + (install.stderr() or "")
        if install.exit_code != 0:
            verdict["verdict"] = "errored"
            verdict["reason"] = f"pip install failed (exit {install.exit_code})"
            verdict["exit_code"] = install.exit_code
            verdict["stdout_tail"] = _tail(install_out, 2000)
            return verdict

        pytest_args: list[str] = ["-m", "pytest", test_rel, "-v", "--tb=short", "-x"]
        if test_name:
            pytest_args.extend(["-k", test_name])
        run = box.run_command(
            "python",
            pytest_args,
            env={"PYTHONDONTWRITEBYTECODE": "1", "PYTHONUNBUFFERED": "1"},
        )
        combined = (run.stdout() or "") + "\n" + (run.stderr() or "")
        verdict["exit_code"] = run.exit_code
        verdict["stdout_tail"] = _tail(combined.strip(), 2400)
        verdict["verdict"] = "passed" if run.exit_code == 0 else "failed"
        if verdict["verdict"] == "failed":
            verdict["reason"] = f"pytest exit {run.exit_code}"
        return verdict

    except Exception as e:
        verdict["verdict"] = "errored"
        verdict["reason"] = f"sandbox error: {e!r}"[:400]
        print(f"[PipelineMedic] Vercel Sandbox verification errored: {e!r}", flush=True)
        return verdict
    finally:
        verdict["duration_ms"] = int((_time.monotonic() - started_at) * 1000)
        if box is not None:
            try:
                box.stop()
            except Exception:
                pass
            try:
                box.client.close()
            except Exception:
                pass
        if span is not None:
            try:
                span.update(
                    output={
                        "verdict": verdict["verdict"],
                        "exit_code": verdict["exit_code"],
                        "duration_ms": verdict["duration_ms"],
                        "sandbox_id": verdict["sandbox_id"],
                        "stdout_tail": verdict["stdout_tail"][:1500],
                        "reason": verdict["reason"],
                    },
                    level="DEFAULT" if verdict["verdict"] == "passed" else "WARNING",
                    status_message=verdict["reason"] or verdict["verdict"],
                )
            except Exception:
                pass
            try:
                span.end()
            except Exception:
                pass


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


# --- Incident state (interactive Telegram flow) -------------------------------
# Ephemeral: in-memory + /tmp JSON. Sufficient for hackathon demos on Vercel
# (warm instance reuse). For production use Vercel KV / Upstash Redis.

def _autofix_ttl_minutes() -> int:
    try:
        n = int(os.getenv("PIPELINEMEDIC_AUTOFIX_TTL_MIN", "10"))
    except ValueError:
        n = 10
    return max(1, min(n, 120))


def _is_expired(incident: dict[str, Any]) -> bool:
    exp = incident.get("expires_at")
    if not exp:
        return False
    try:
        deadline = datetime.fromisoformat(exp)
    except (TypeError, ValueError):
        return False
    return datetime.now(timezone.utc) >= deadline


_INCIDENT_FILE_PATHS = (
    Path("data") / "incidents.json",
    Path("/tmp") / "pipelinemedic_incidents.json",
)
_INCIDENTS: dict[str, dict[str, Any]] = {}
_INCIDENTS_LOADED = False
_MAX_INCIDENTS = 200


def _load_incidents() -> None:
    global _INCIDENTS_LOADED, _INCIDENTS
    if _INCIDENTS_LOADED:
        return
    for path in _INCIDENT_FILE_PATHS:
        try:
            if path.exists():
                raw = path.read_text(encoding="utf-8")
                data = json.loads(raw) if raw.strip() else {}
                if isinstance(data, dict):
                    _INCIDENTS = data
                    break
        except (json.JSONDecodeError, OSError):
            continue
    _INCIDENTS_LOADED = True


def _save_incidents() -> None:
    for path in _INCIDENT_FILE_PATHS:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(_INCIDENTS, indent=2), encoding="utf-8")
            return
        except OSError:
            continue


def store_incident(data: dict[str, Any]) -> str:
    _load_incidents()
    token = secrets.token_hex(4)
    while token in _INCIDENTS:
        token = secrets.token_hex(4)
    _INCIDENTS[token] = data
    if len(_INCIDENTS) > _MAX_INCIDENTS:
        oldest = sorted(_INCIDENTS.items(), key=lambda kv: kv[1].get("ts", ""))[
            : len(_INCIDENTS) - _MAX_INCIDENTS
        ]
        for k, _ in oldest:
            _INCIDENTS.pop(k, None)
    _save_incidents()
    return token


def get_incident(token: str) -> dict[str, Any] | None:
    _load_incidents()
    return _INCIDENTS.get(token)


def update_incident(token: str, **kwargs: Any) -> None:
    _load_incidents()
    if token in _INCIDENTS:
        _INCIDENTS[token].update(kwargs)
        _save_incidents()


# --- Message-embedded state (survives Vercel cold starts) ---------------------
# We base64-encode a compact snapshot of the incident and append it to the
# Telegram message. When a callback fires, Telegram hands us the full message
# text; we decode the state from there so we don't depend on /tmp being warm.

_STATE_MARKER = "pm-state:"
_STATE_FENCE = "\n\n⸻\n"


def _encode_state(state: dict[str, Any]) -> str:
    raw = json.dumps(state, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _decode_state(message_text: str) -> dict[str, Any] | None:
    if not message_text:
        return None
    idx = message_text.rfind(_STATE_MARKER)
    if idx < 0:
        return None
    tail = message_text[idx + len(_STATE_MARKER) :].strip()
    token = tail.split()[0] if tail else ""
    if not token:
        return None
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
        parsed = json.loads(raw.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else None
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _build_state_snapshot(
    *,
    token: str,
    incident: dict[str, Any],
    github_override: dict[str, Any] | None = None,
    status_override: str | None = None,
) -> dict[str, Any]:
    a = incident.get("analysis") or {}
    gh = github_override if github_override is not None else incident.get("github")
    snap: dict[str, Any] = {
        "tok": token,
        "repo": incident.get("repository"),
        "repo_full": incident.get("repository_full_name"),
        "an": {
            "root_cause": (str(a.get("root_cause") or ""))[:300],
            "fix": (str(a.get("fix") or ""))[:300],
            "file": a.get("file") or "",
            "confidence": a.get("confidence"),
            "fixable": a.get("fixable"),
        },
        "log": (incident.get("log_excerpt") or "")[:400],
        "exp": incident.get("expires_at"),
        "st": status_override if status_override is not None else incident.get("status"),
    }
    if gh:
        snap["gh"] = {
            "pr": gh.get("pull_number"),
            "url": gh.get("html_url"),
            "br": gh.get("branch"),
            "base": gh.get("base"),
            "file": gh.get("file"),
            "patch_source": gh.get("patch_source"),
        }
    return snap


def _attach_state(text: str, state: dict[str, Any]) -> str:
    """No-op: we keep the user-facing message clean.

    Historically we appended a base64-encoded snapshot of the incident to
    every Telegram message so a cold-started Vercel instance could
    reconstruct state purely from the callback payload. That made the
    message visually noisy, so we now rely on the server-side incident
    store (in-memory + `/tmp/pipelinemedic_incidents.json`).

    If you deploy across many cold-starting containers and need 100%
    reliability, replace the `_INCIDENTS` store with a KV backend
    (Upstash Redis, Vercel KV, etc.) — every other piece of the flow
    already reads/writes through ``store_incident`` / ``get_incident``.
    """
    del state  # intentionally unused; see docstring
    return text


def _incident_from_snapshot(snap: dict[str, Any]) -> dict[str, Any]:
    gh = snap.get("gh") or {}
    return {
        "repository": snap.get("repo"),
        "repository_full_name": snap.get("repo_full"),
        "log_excerpt": snap.get("log"),
        "analysis": snap.get("an") or {},
        "expires_at": snap.get("exp"),
        "status": snap.get("st"),
        "message_targets": [],
        "github": {
            "pull_number": gh.get("pr"),
            "html_url": gh.get("url"),
            "branch": gh.get("br"),
            "base": gh.get("base"),
            "file": gh.get("file"),
            "patch_source": gh.get("patch_source"),
            "ok": True,
            "mode": "github",
        }
        if gh
        else None,
    }


# --- Telegram interactive helpers ---------------------------------------------

def _tg_request(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        return {}
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/{method}",
            json=payload,
            timeout=15,
        )
        try:
            return r.json()
        except ValueError:
            return {}
    except requests.RequestException as e:
        print(f"[PipelineMedic] Telegram {method} failed: {e}", flush=True)
        return {}


def _h(value: Any) -> str:
    """HTML-escape a value for safe embedding in Telegram HTML messages."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def tg_send_with_buttons(
    chat_id: int | str,
    text: str,
    buttons: list[list[dict[str, Any]]],
) -> dict[str, Any]:
    return _tg_request(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": {"inline_keyboard": buttons},
        },
    )


def tg_send_html(chat_id: int | str, text: str) -> dict[str, Any]:
    """Plain Telegram message (no inline keyboard), HTML parse mode."""
    return _tg_request(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        },
    )


def tg_edit_message(
    chat_id: int | str,
    message_id: int,
    text: str,
    buttons: list[list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if buttons is not None:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    return _tg_request("editMessageText", payload)


def tg_answer_callback(callback_id: str, text: str = "") -> dict[str, Any]:
    payload: dict[str, Any] = {"callback_query_id": callback_id}
    if text:
        payload["text"] = text[:200]
    return _tg_request("answerCallbackQuery", payload)


def _broadcast_edit(
    incident: dict[str, Any],
    text: str,
    buttons: list[list[dict[str, Any]]] | None,
) -> None:
    for tgt in incident.get("message_targets") or []:
        cid = tgt.get("chat_id")
        mid = tgt.get("message_id")
        if cid is not None and mid is not None:
            tg_edit_message(cid, mid, text, buttons)


def _broadcast_new_message(
    incident: dict[str, Any],
    text: str,
    buttons: list[list[dict[str, Any]]] | None,
) -> list[dict[str, Any]]:
    """Post a brand-new message to every chat that got the original alert.

    Each pipeline stage (initial alert → PR opened → merged/rolled-back)
    is its own standalone message so the Telegram chat shows the full
    timeline instead of one edited bubble. Returns the new targets so
    callers can append them to the incident for future broadcasts.
    """
    new_targets: list[dict[str, Any]] = []
    seen_chats: set[Any] = set()
    for tgt in incident.get("message_targets") or []:
        cid = tgt.get("chat_id")
        if cid is None or cid in seen_chats:
            continue
        seen_chats.add(cid)
        try:
            resp = tg_send_with_buttons(cid, text, buttons or [])
        except Exception as e:
            print(f"[PipelineMedic] broadcast send failed for {cid}: {e}", flush=True)
            continue
        mid = ((resp or {}).get("result") or {}).get("message_id")
        if mid is not None:
            new_targets.append({"chat_id": cid, "message_id": mid})
    return new_targets


# --- Interactive message builders ---------------------------------------------

_PATCH_SOURCE_LABEL = {
    "llm": "LLM-synthesized",
    "rule:append_requirement": "rule-based (dependency)",
    "rule:new_requirements": "rule-based (new requirements.txt)",
    "demo:audit_stamp": "demo audit stamp (no live bug to fix)",
}


def _format_confidence(value: Any) -> str:
    try:
        return f"{float(value):.0%}"
    except (TypeError, ValueError):
        return "—"


def _format_source(source: str) -> str:
    if source == "groq":
        return "Groq LLM"
    if source == "rules":
        return "rule-based"
    return source or "unknown"


def _repo_line(repository: str) -> str:
    return f"<b>Repo</b> · <code>{_h(repository)}</code>"


def build_initial_interactive_message(
    repository: str,
    log_excerpt: str,
    analysis: dict[str, Any],
    source: str,
    decision: str,
    token: str,
    expires_at: datetime | None = None,
    ttl_minutes: int | None = None,
) -> str:
    """Initial alert. Clean, professional, no meta noise."""

    lines: list[str] = ["🚨 <b>PipelineMedic — CI failure detected</b>", ""]
    lines.append(_repo_line(repository))
    if expires_at is not None and ttl_minutes is not None:
        lines.append(
            f"<b>Window</b> · {ttl_minutes} min "
            f"(expires {_h(expires_at.strftime('%H:%M UTC'))})"
        )
    lines.append("")

    error = _clip(log_excerpt or "(no log excerpt)", 500)
    lines.append("<b>Error</b>")
    lines.append(f"<pre>{_h(error)}</pre>")

    root_cause = _clip(str(analysis.get("root_cause") or ""), 400).strip()
    if root_cause:
        lines.append("<b>Diagnosis</b>")
        lines.append(_h(root_cause))
        lines.append("")

    fix = _clip(str(analysis.get("fix") or ""), 400).strip()
    if fix:
        lines.append("<b>Proposed fix</b>")
        lines.append(_h(fix))
        lines.append("")

    file_hint = (analysis.get("file") or "").strip()
    if file_hint:
        lines.append(f"<b>Likely file</b> · <code>{_h(file_hint)}</code>")

    conf = _format_confidence(analysis.get("confidence"))
    src_label = _format_source(source)
    fixable_hint = "auto-fix eligible" if analysis.get("fixable") else "advisory only"
    lines.append(
        f"<i>Confidence {_h(conf)} · {_h(fixable_hint)} · analysed by {_h(src_label)}</i>"
    )

    return "\n".join(lines)


def build_pr_created_message(
    incident: dict[str, Any],
    github_info: dict[str, Any],
) -> str:
    repo = incident.get("repository", "")
    analysis = incident.get("analysis") or {}
    pr_url = github_info.get("html_url", "")
    branch = github_info.get("branch", "")
    pr_num = github_info.get("pull_number", "")
    patch_source = github_info.get("patch_source") or "llm"
    label = _PATCH_SOURCE_LABEL.get(patch_source, patch_source)
    file = github_info.get("file") or analysis.get("file") or "—"
    fix = _clip(str(analysis.get("fix") or ""), 400).strip()

    lines: list[str] = ["✅ <b>Auto-fix PR opened</b>", ""]
    lines.append(_repo_line(repo))
    if pr_url:
        lines.append(
            f"<b>PR</b> · <a href=\"{_h(pr_url)}\">#{_h(pr_num)}</a>"
        )
    if branch:
        lines.append(f"<b>Branch</b> · <code>{_h(branch)}</code>")
    lines.append(f"<b>File</b> · <code>{_h(file)}</code>")
    lines.append(f"<b>Patch source</b> · {_h(label)}")
    reg = github_info.get("regression_test") or {}
    reg_qual = reg.get("qualified") if isinstance(reg, dict) else None
    if reg_qual:
        lines.append(
            f"🧪 <b>Regression test</b> · <code>{_h(reg_qual)}</code>"
        )
    verification = github_info.get("verification")
    if isinstance(verification, dict) and verification.get("verdict"):
        verdict = verification.get("verdict")
        emoji, label = _VERIFIED_BADGE.get(verdict, _VERIFIED_BADGE["skipped"])
        duration_ms = verification.get("duration_ms") or 0
        dur = f"{duration_ms / 1000:.1f}s" if duration_ms else "—"
        exit_code = verification.get("exit_code")
        exit_part = f"exit {exit_code}" if exit_code is not None else "no run"
        self_corrected = bool(verification.get("self_corrected"))
        detail = f"{_h(dur)} · {_h(exit_part)}"
        if self_corrected:
            detail += " · 🔁 self-corrected"
        lines.append(f"{emoji} <b>{_h(label)}</b> · {detail}")
    if fix:
        lines.append("")
        lines.append("<b>What changed</b>")
        lines.append(_h(fix))
    lines.append("")
    lines.append("Review the diff, then merge to <code>main</code> or roll back.")
    return "\n".join(lines)


def build_pr_failed_message(
    incident: dict[str, Any],
    github_info: dict[str, Any],
) -> str:
    repo = incident.get("repository", "")
    err = github_info.get("error") or github_info.get("message") or "unknown error"
    return "\n".join(
        [
            "❌ <b>Auto-fix PR could not be opened</b>",
            "",
            _repo_line(repo),
            f"<b>Reason</b> · <code>{_h(err)}</code>",
            "",
            "Please fix this one manually.",
        ]
    )


def build_manual_message(incident: dict[str, Any]) -> str:
    repo = incident.get("repository", "")
    analysis = incident.get("analysis") or {}
    fix = _clip(str(analysis.get("fix") or ""), 400).strip()
    file = (analysis.get("file") or "—").strip() or "—"
    lines: list[str] = ["🛠 <b>Manual fix selected</b>", ""]
    lines.append(_repo_line(repo))
    lines.append(f"<b>File</b> · <code>{_h(file)}</code>")
    if fix:
        lines.append("")
        lines.append("<b>Suggested fix</b>")
        lines.append(_h(fix))
    lines.append("")
    lines.append("PipelineMedic will not open a PR for this incident.")
    return "\n".join(lines)


def build_merged_message(incident: dict[str, Any], result: dict[str, Any]) -> str:
    pr = (incident.get("github") or {}).get("html_url", "")
    pr_num = (incident.get("github") or {}).get("pull_number", "")
    if result.get("ok"):
        sha = (result.get("sha") or "")[:7]
        lines = ["🎉 <b>Merged to main</b>", ""]
        lines.append(_repo_line(incident.get("repository", "")))
        if pr:
            lines.append(
                f"<b>PR</b> · <a href=\"{_h(pr)}\">#{_h(pr_num)}</a>"
            )
        if sha:
            lines.append(f"<b>Commit</b> · <code>{_h(sha)}</code>")
        lines.append("")
        lines.append("Incident resolved.")
        return "\n".join(lines)
    return "\n".join(
        [
            "❌ <b>Merge failed</b>",
            "",
            _repo_line(incident.get("repository", "")),
            f"<b>Reason</b> · <code>{_h(result.get('error') or 'unknown')}</code>",
        ]
    )


def build_rollback_message(incident: dict[str, Any], result: dict[str, Any]) -> str:
    pr = (incident.get("github") or {}).get("html_url", "")
    pr_num = (incident.get("github") or {}).get("pull_number", "")
    if result.get("ok"):
        lines = ["↩️ <b>Rolled back</b>", ""]
        lines.append(_repo_line(incident.get("repository", "")))
        if pr:
            lines.append(
                f"<b>PR</b> · <a href=\"{_h(pr)}\">#{_h(pr_num)}</a> (closed)"
            )
        lines.append("")
        lines.append(
            "AI branch deleted. <code>main</code> was not modified."
        )
        return "\n".join(lines)
    return "\n".join(
        [
            "❌ <b>Rollback failed</b>",
            "",
            _repo_line(incident.get("repository", "")),
            f"<b>Reason</b> · <code>{_h(result.get('error') or 'unknown')}</code>",
        ]
    )


def build_expired_message(incident: dict[str, Any]) -> str:
    return "\n".join(
        [
            "⏰ <b>Decision window expired</b>",
            "",
            _repo_line(incident.get("repository", "")),
            "",
            "Re-run the pipeline to trigger a new analysis.",
        ]
    )


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


def _fetch_file(
    token: str, owner: str, repo: str, path: str, ref: str
) -> tuple[str | None, str | None]:
    """Return (content, sha) or (None, None) if the file doesn't exist."""
    r = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers=_gh_headers(token),
        params={"ref": ref},
        timeout=30,
    )
    if r.status_code != 200:
        return None, None
    try:
        data = r.json()
        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return content, data.get("sha")
    except (KeyError, ValueError):
        return None, None


def _demo_audit_patch(
    current_content: str,
    analysis: dict[str, Any],
    reason: str,
) -> tuple[str, str]:
    """Fallback "demo patch" — guarantees a visible diff + real PR.

    When the LLM can't (or needn't) produce a change — e.g. the repo
    is already healthy, or analysis is ambiguous — we still open a PR
    so the end-to-end demo flow stays intact. The patch is a single
    non-executing comment line tagged with the incident's root cause,
    appended at the end of the file. It never modifies code semantics.
    """
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    root_cause = _clip(str(analysis.get("root_cause") or "CI incident"), 140)
    stamp_line = (
        f"# PipelineMedic audit ({ts}): {root_cause} "
        f"[patch fallback: {reason}]"
    )
    base = current_content.rstrip("\n")
    return f"{base}\n\n{stamp_line}\n", "demo:audit_stamp"


def _safe_patch_reason(old: str, new: str) -> str | None:
    """Return None if the patch is safe, otherwise a short reason string.

    Reject empty output, or an LLM response that removed so much of the
    original file it's almost certainly a snippet instead of the full
    replacement we asked for. For tiny files we are permissive: any
    non-empty, non-identical output is accepted.
    """
    if not new or not new.strip():
        return "empty"
    if new == old:
        return "unchanged"
    old_lines = [line for line in old.splitlines() if line.strip()]
    new_lines = [line for line in new.splitlines() if line.strip()]
    if not old_lines:
        return None
    if len(old_lines) < 8:
        return None
    if len(new_lines) < max(3, int(len(old_lines) * 0.4)):
        return (
            f"shrunk ({len(new_lines)} lines after, {len(old_lines)} before) —"
            " looks like a snippet, not full file"
        )
    return None


def _looks_like_safe_patch(old: str, new: str) -> bool:
    """Backwards-compatible boolean wrapper around ``_safe_patch_reason``."""
    return _safe_patch_reason(old, new) is None


def _strip_code_fences(text: str) -> str:
    """Remove ```lang ... ``` wrappers if the LLM produced them."""
    s = text.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines)
    return s


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


def _verification_pr_body_block(verification: dict[str, Any]) -> list[str]:
    """Render the sandbox-verification section of the PR body."""
    verdict = verification.get("verdict") or "skipped"
    headings = {
        "passed": "### ✅ Sandbox pre-verification (Vercel Sandbox)",
        "failed": "### ⚠️ Sandbox pre-verification (Vercel Sandbox) — test FAILED",
        "errored": "### ⚠️ Sandbox pre-verification (Vercel Sandbox) — errored",
        "skipped": "### ➖ Sandbox pre-verification (Vercel Sandbox) — skipped",
    }
    lines: list[str] = [
        "",
        headings.get(verdict, headings["skipped"]),
        "",
        (
            "Before opening this PR, PipelineMedic executed the AI-generated "
            "fix *and* the AI-generated regression test together inside a "
            "fresh Firecracker microVM (Vercel Sandbox). The verdict below is "
            "the live output of that run."
        ),
        "",
        f"- **Verdict:** `{verdict}`",
        f"- **Exit code:** `{verification.get('exit_code')}`",
        f"- **Duration:** `{verification.get('duration_ms')} ms`",
        f"- **Runtime:** `{verification.get('runtime')}`",
        f"- **Sandbox ID:** `{verification.get('sandbox_id') or '—'}`",
    ]
    if verification.get("self_corrected"):
        lines.append(
            "- **Self-correction:** the AI re-generated the patch after an "
            "initial sandbox failure and re-ran the test."
        )
    reason = (verification.get("reason") or "").strip()
    if reason:
        lines.append(f"- **Reason:** `{reason}`")
    tail = (verification.get("stdout_tail") or "").strip()
    if tail:
        lines.extend(
            [
                "",
                "<details><summary>Pytest output (tail)</summary>",
                "",
                "```",
                tail,
                "```",
                "",
                "</details>",
            ]
        )
    return lines


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

    def_branch = _get_default_branch(token, owner, repo)
    if not def_branch:
        return {
            "ok": False,
            "mode": "error",
            "error": "Repository not accessible or empty (needs initial commit)",
        }
    use_base = base_branch if base_branch else def_branch

    # Fetch the real, current file from base BEFORE we make any branches so
    # we can ask the LLM to patch the actual source.
    cur_content, _ = _fetch_file(token, owner, repo, target_file, use_base)

    incident_token = str(analysis.get("_incident_token") or "").strip()
    repo_slug = f"{owner}/{repo}"

    patch_source: str = "none"
    new_content: str
    generated_test: str | None = None
    test_path: str | None = None
    existing_test: str | None = None
    verification: dict[str, Any] | None = None

    if cur_content is None:
        # File doesn't exist on base: we only safely handle the
        # "missing requirements.txt" case by creating it.
        if target_file.endswith("requirements.txt"):
            m = re.search(r"`([^`]+)`", fix_text)
            pkg = m.group(1).strip() if m else ""
            new_content = (pkg + "\n") if pkg else "# PipelineMedic autofix — add deps here\n"
            patch_source = "rule:new_requirements"
        else:
            return {
                "ok": False,
                "mode": "error",
                "error": f"target file not found on {use_base}: {target_file}",
            }
    else:
        log_excerpt = str(analysis.get("_log_excerpt") or "")

        def _try_llm(strict: bool, sandbox_feedback: str | None = None) -> tuple[str | None, str]:
            out = generate_fix_content(
                cur_content,
                target_file,
                analysis,
                repo_slug,
                log_excerpt=log_excerpt,
                strict=strict,
                sandbox_feedback=sandbox_feedback,
            )
            if out is None:
                return None, "llm_call_failed"
            reason = _safe_patch_reason(cur_content, out)
            if reason is None:
                return out, "ok"
            print(
                f"[PipelineMedic] LLM patch rejected "
                f"(strict={strict}): {reason}",
                flush=True,
            )
            return None, reason

        generated, reject_reason = _try_llm(strict=False)
        if generated is None and reject_reason in {"unchanged", "empty", "llm_call_failed"}:
            generated, reject_reason = _try_llm(strict=True)

        if generated is not None:
            new_content = generated
            patch_source = "llm"
        elif target_file.endswith("requirements.txt"):
            m = re.search(r"`([^`]+)`", fix_text)
            pkg = (m.group(1).strip() if m else "").strip()
            if pkg and pkg.lower() not in cur_content.lower():
                new_content = cur_content.rstrip() + "\n" + pkg + "\n"
                patch_source = "rule:append_requirement"
            else:
                new_content, patch_source = _demo_audit_patch(
                    cur_content, analysis, reject_reason
                )
        else:
            new_content, patch_source = _demo_audit_patch(
                cur_content, analysis, reject_reason
            )

        # --- Sandbox self-verification (before any git operations) ---------
        # We generate the regression test in-memory and then execute the
        # fix + test together inside a fresh Vercel Sandbox microVM. If the
        # test fails, we give the AI one chance to self-correct using the
        # real pytest output as feedback, then re-verify. Whatever the
        # outcome, we still open the PR — but the reviewer sees an
        # explicit, traced verdict.
        if (
            patch_source == "llm"
            and target_file.endswith(".py")
            and cur_content is not None
        ):
            # Pull the repo's real runtime deps so the sandbox mirrors CI,
            # not a hardcoded guess. Falls back gracefully if missing.
            repo_requirements, _ = _fetch_file(
                token, owner, repo, "requirements.txt", use_base
            )
            try:
                test_path = _derive_test_path(target_file)
                existing_test, _ = _fetch_file(token, owner, repo, test_path, use_base)
                generated_test = generate_regression_test(
                    cur_content,
                    new_content,
                    analysis,
                    repo_slug,
                    target_file,
                    existing_test_content=existing_test,
                )
            except Exception as e:
                print(f"[PipelineMedic] regression test synthesis failed: {e}", flush=True)
                generated_test = None

            if generated_test:
                verify_test_code = _merge_test_into_file(existing_test, generated_test)
                test_name = _parse_test_name(generated_test) or "test_regression"
                verification = verify_patch_in_vercel_sandbox(
                    source_path=target_file,
                    source_content=new_content,
                    test_path=test_path,
                    test_content=verify_test_code,
                    test_name=test_name,
                    repository=repo_slug,
                    incident_token=incident_token,
                    repo_requirements=repo_requirements,
                )

                # One self-healing retry if the sandbox actually RAN the test
                # and it failed. Errored/skipped don't retry — the signal is
                # too noisy to be worth another LLM round-trip.
                if verification and verification.get("verdict") == "failed":
                    retry_hint = (
                        f"test: {test_name}\n"
                        f"exit_code: {verification.get('exit_code')}\n"
                        f"sandbox_id: {verification.get('sandbox_id')}\n\n"
                        f"{verification.get('stdout_tail', '')}"
                    )
                    retry_out, retry_reason = _try_llm(
                        strict=True,
                        sandbox_feedback=retry_hint,
                    )
                    if retry_out is not None:
                        new_content = retry_out
                        try:
                            generated_test_v2 = generate_regression_test(
                                cur_content,
                                new_content,
                                analysis,
                                repo_slug,
                                target_file,
                                existing_test_content=existing_test,
                            )
                        except Exception as e:
                            print(
                                f"[PipelineMedic] regression test v2 synthesis failed: {e}",
                                flush=True,
                            )
                            generated_test_v2 = None
                        if generated_test_v2:
                            generated_test = generated_test_v2
                            verify_test_code = _merge_test_into_file(
                                existing_test, generated_test
                            )
                            test_name = _parse_test_name(generated_test) or test_name
                        verification = verify_patch_in_vercel_sandbox(
                            source_path=target_file,
                            source_content=new_content,
                            test_path=test_path,
                            test_content=verify_test_code,
                            test_name=test_name,
                            repository=repo_slug,
                            incident_token=incident_token,
                            repo_requirements=repo_requirements,
                        )
                        if verification is not None:
                            verification["self_corrected"] = True
                    else:
                        print(
                            f"[PipelineMedic] self-heal retry rejected: {retry_reason}",
                            flush=True,
                        )

    # --- Commit fix + test atomically on a fresh branch --------------------
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    branch_name = f"pipelinemedic/autofix-{ts}"

    ok_b, err_b = _create_branch(token, owner, repo, use_base, branch_name)
    if not ok_b:
        return {"ok": False, "mode": "error", "error": err_b or "branch error"}

    file_sha = _get_file_sha(token, owner, repo, target_file, branch_name)
    ok_f, err_f = _put_file(
        token,
        owner,
        repo,
        target_file,
        branch_name,
        new_content,
        f"fix: PipelineMedic autofix ({target_file})",
        file_sha,
    )
    if not ok_f:
        return {"ok": False, "mode": "error", "error": err_f or "file update error"}

    test_info: dict[str, str] | None = None
    if generated_test and test_path:
        try:
            merged_test_file = _merge_test_into_file(existing_test, generated_test)
            test_name = _parse_test_name(generated_test) or "test_regression"
            existing_test_sha = _get_file_sha(token, owner, repo, test_path, branch_name)
            ok_t, err_t = _put_file(
                token,
                owner,
                repo,
                test_path,
                branch_name,
                merged_test_file,
                f"test: PipelineMedic regression test ({test_name})",
                existing_test_sha,
            )
            if ok_t:
                test_info = {
                    "file": test_path,
                    "name": test_name,
                    "qualified": f"{test_path}::{test_name}",
                }
            else:
                print(
                    f"[PipelineMedic] regression test commit failed: {err_t}",
                    flush=True,
                )
        except Exception as e:
            print(f"[PipelineMedic] regression test commit crashed: {e}", flush=True)

    title = f"PipelineMedic autofix: {analysis.get('root_cause', 'CI fix')[:80]}"
    pr_body_parts = [
        "Automated suggestion (review required).",
        "",
        f"**Root cause:** {analysis.get('root_cause')}",
        "",
        f"**Fix:** {analysis.get('fix')}",
        "",
        f"**Patched file:** `{target_file}`",
    ]
    if test_info is not None:
        pr_body_parts.extend(
            [
                "",
                "### 🧪 Regression test (auto-generated)",
                "",
                "PipelineMedic also generated a regression test that would have "
                "caught this bug before the fix. Merging this PR both resolves "
                "this incident and immunises the repo against future regressions.",
                "",
                f"- File: `{test_info['file']}`",
                f"- Test: `{test_info['name']}`",
            ]
        )
    if verification is not None:
        pr_body_parts.extend(_verification_pr_body_block(verification))
    pr_body = "\n".join(pr_body_parts)

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
        "file": target_file,
        "patch_source": patch_source,
        "regression_test": test_info,
        "verification": verification,
    }


def merge_pull_request(incident: dict[str, Any]) -> dict[str, Any]:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        return {"ok": False, "error": "GITHUB_TOKEN not set"}
    gh = incident.get("github") or {}
    pr_num = gh.get("pull_number")
    if not pr_num:
        return {"ok": False, "error": "missing PR number"}
    owner, repo = resolve_repo_slug(
        incident.get("repository", ""),
        incident.get("repository_full_name"),
    )
    if not owner or not repo:
        return {"ok": False, "error": "could not resolve owner/repo"}

    method = (os.getenv("GITHUB_MERGE_METHOD", "merge").strip() or "merge").lower()
    if method not in ("merge", "squash", "rebase"):
        method = "merge"

    r = requests.put(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_num}/merge",
        headers=_gh_headers(token),
        json={"merge_method": method},
        timeout=30,
    )
    if r.status_code in (200, 201):
        try:
            data = r.json()
        except ValueError:
            data = {}
        return {"ok": True, "merged": True, "sha": data.get("sha"), "method": method}
    return {"ok": False, "error": f"{r.status_code} {r.text[:300]}"}


def rollback_pull_request(incident: dict[str, Any]) -> dict[str, Any]:
    """Pre-merge rollback: close PR and delete AI branch. main is untouched.

    For post-merge revert (true rollback after merging), open a revert PR
    against main using GitHub's revert endpoint or git revert manually.
    """
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        return {"ok": False, "error": "GITHUB_TOKEN not set"}
    gh = incident.get("github") or {}
    pr_num = gh.get("pull_number")
    branch = gh.get("branch")
    if not pr_num or not branch:
        return {"ok": False, "error": "missing PR or branch"}
    owner, repo = resolve_repo_slug(
        incident.get("repository", ""),
        incident.get("repository_full_name"),
    )
    if not owner or not repo:
        return {"ok": False, "error": "could not resolve owner/repo"}

    rc = requests.patch(
        f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_num}",
        headers=_gh_headers(token),
        json={"state": "closed"},
        timeout=30,
    )
    closed = rc.status_code == 200

    rd = requests.delete(
        f"{GITHUB_API}/repos/{owner}/{repo}/git/refs/heads/{branch}",
        headers=_gh_headers(token),
        timeout=30,
    )
    deleted = rd.status_code in (200, 204)

    return {
        "ok": closed and deleted,
        "closed": closed,
        "branch_deleted": deleted,
        "error": None
        if (closed and deleted)
        else f"close={rc.status_code}, delete={rd.status_code}",
    }


# --- GitHub repository Webhooks (push → Telegram) ------------------------------

def _github_webhook_signature_ok(body: bytes, signature_header: str | None) -> bool:
    """Validate ``X-Hub-Signature-256`` when ``GITHUB_WEBHOOK_SECRET`` is set."""
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()
    if not secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={mac}"
    return hmac.compare_digest(signature_header.strip(), expected)


def _github_push_skip_reason(payload: dict[str, Any]) -> str | None:
    """Return a machine-readable skip reason, or None to deliver Telegram."""
    ref = str(payload.get("ref") or "")
    if ref.startswith("refs/tags/"):
        return "tag_push"
    branch = ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else ref
    raw = os.getenv(
        "GITHUB_PUSH_SKIP_BRANCH_PREFIXES",
        "pipelinemedic/autofix-,dependabot/",
    ).strip()
    for p in raw.split(","):
        p = p.strip()
        if p and branch.startswith(p):
            return f"branch_prefix:{p}"
    return None


def build_github_push_telegram_message(payload: dict[str, Any]) -> str:
    """HTML body for a GitHub ``push`` event (web commit, git push, merge)."""
    repo = (payload.get("repository") or {}).get("full_name") or "unknown/repo"
    ref = str(payload.get("ref") or "")
    branch = (
        ref.removeprefix("refs/heads/")
        if ref.startswith("refs/heads/")
        else ref or "—"
    )
    pusher = (payload.get("pusher") or {}).get("name") or "—"
    sender = (payload.get("sender") or {}).get("login")
    by_line = _h(pusher)
    if sender and sender != pusher:
        by_line = f"{by_line} · @{_h(sender)}"

    commits = list(payload.get("commits") or [])
    head = payload.get("head_commit") or {}
    if not commits and head.get("id"):
        commits = [head]
    n = len(commits)

    lines: list[str] = [
        "📌 <b>PipelineMedic · GitHub push</b>",
        "",
        f"Repo · <code>{_h(repo)}</code>",
        f"Branch · <code>{_h(branch)}</code>",
        f"By · {by_line}",
        f"Commits · {n}",
        "",
    ]
    for c in commits[:5]:
        msg_raw = str((c or {}).get("message") or "").strip()
        msg_lines = msg_raw.splitlines()
        msg = (msg_lines[0] if msg_lines else "")[:120]
        cid = str((c or {}).get("id") or "")[:7]
        if cid:
            lines.append(f"• <code>{_h(cid)}</code> {_h(msg) if msg else '—'}")
        elif msg:
            lines.append(f"• {_h(msg)}")
    if len(commits) > 5:
        lines.append(f"• … and {len(commits) - 5} more")

    compare = str(payload.get("compare") or "").strip()
    if compare:
        safe_url = compare.replace("&", "&amp;")
        lines.extend(["", f'<a href="{safe_url}">Open compare on GitHub</a>'])

    return "\n".join(lines)


async def handle_github_repo_webhook(request: Request) -> JSONResponse:
    """GitHub ``push`` deliveries → Telegram (configure per-repo in GitHub UI)."""
    if os.getenv("GITHUB_PUSH_NOTIFY_DISABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return JSONResponse({"ok": True, "skipped": "disabled_by_env"})

    body_bytes = await request.body()
    sig = request.headers.get("x-hub-signature-256") or request.headers.get(
        "X-Hub-Signature-256"
    )
    if not _github_webhook_signature_ok(body_bytes, sig):
        return JSONResponse(status_code=401, content={"detail": "invalid signature"})

    try:
        payload = json.loads(body_bytes.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JSONResponse(status_code=400, content={"detail": "invalid json"})

    event = (
        request.headers.get("x-github-event")
        or request.headers.get("X-GitHub-Event")
        or ""
    ).strip()

    if event == "ping":
        return JSONResponse({"ok": True, "message": "pong"})

    if event != "push":
        return JSONResponse({"ok": True, "ignored_event": event or "unknown"})

    skip = _github_push_skip_reason(payload)
    if skip:
        return JSONResponse({"ok": True, "skipped": skip})

    if not _telegram_configured():
        return JSONResponse(
            status_code=503,
            content={"detail": "telegram not configured"},
        )

    text = build_github_push_telegram_message(payload)
    sent = 0
    for chat_id in _telegram_chat_ids():
        resp = tg_send_html(chat_id, text)
        if (resp or {}).get("ok"):
            sent += 1
    return JSONResponse({"ok": True, "telegram_messages": sent})


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
        "version": "1.4.1",
        "groq_configured": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "telegram_configured": bool(
            os.getenv("TELEGRAM_BOT_TOKEN", "").strip() and _telegram_chat_ids()
        ),
        "github_token_configured": bool(os.getenv("GITHUB_TOKEN", "").strip()),
        "langfuse_configured": bool(
            os.getenv("LANGFUSE_SECRET_KEY", "").strip()
            and os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
        ),
        "vercel_sandbox_configured": _vercel_sandbox_credentials_present(),
        "vercel_auth_mode": (
            "oidc" if os.getenv("VERCEL_OIDC_TOKEN", "").strip()
            else "token" if (
                os.getenv("VERCEL_TOKEN", "").strip()
                and os.getenv("VERCEL_TEAM_ID", "").strip()
                and os.getenv("VERCEL_PROJECT_ID", "").strip()
            )
            else "none"
        ),
        "github_push_webhook_secret_configured": bool(
            os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()
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

        now = datetime.now(timezone.utc)
        ttl_min = _autofix_ttl_minutes()
        expires_at = now + timedelta(minutes=ttl_min)
        analysis_with_log = {**analysis, "_log_excerpt": log_excerpt}
        token = store_incident(
            {
                "ts": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "ttl_minutes": ttl_min,
                "repository": repo_str,
                "repository_full_name": (
                    str(repository_full_name).strip() if repository_full_name else None
                ),
                "log_excerpt": log_excerpt,
                "analysis": analysis_with_log,
                "source": source,
                "decision": decision,
                "status": "awaiting_choice",
                "message_targets": [],
            }
        )

        notify_console_mock_slack(
            repo_str, decision, analysis, source, log_excerpt, {}
        )

        base_text = build_initial_interactive_message(
            repo_str,
            log_excerpt,
            analysis,
            source,
            decision,
            token,
            expires_at=expires_at,
            ttl_minutes=ttl_min,
        )
        incident_for_state = get_incident(token) or {}
        state = _build_state_snapshot(token=token, incident=incident_for_state)
        text = _attach_state(base_text, state)
        buttons = [
            [
                {"text": "🤖 Auto fix", "callback_data": f"autofix:{token}"},
                {"text": "🛠 Manual fix", "callback_data": f"manual:{token}"},
            ]
        ]
        targets: list[dict[str, Any]] = []
        if _telegram_configured():
            for chat_id in _telegram_chat_ids():
                resp = tg_send_with_buttons(chat_id, text, buttons)
                msg_id = (((resp or {}).get("result") or {}).get("message_id"))
                if msg_id:
                    targets.append({"chat_id": chat_id, "message_id": msg_id})
            if targets:
                update_incident(token, message_targets=targets)

        try:
            append_incident(repo_str, log_excerpt, analysis, decision)
        except Exception:
            pass

        return JSONResponse(
            status_code=200,
            content={
                "status": "awaiting_user_choice",
                "incident": token,
                "repository": repo_str,
                "decision": decision,
                "analysis": analysis,
                "analysis_source": source,
                "telegram_targets": len(targets),
            },
        )
    finally:
        _langfuse_flush()


async def handle_telegram_callback(body: dict[str, Any]) -> JSONResponse:
    cq = body.get("callback_query") or {}
    callback_id = str(cq.get("id") or "")
    data = str(cq.get("data") or "")

    parts = data.split(":")
    action = parts[0] if parts else ""
    tok = parts[1] if len(parts) > 1 else ""

    # Pull state: first from server /tmp, then fall back to the state
    # embedded inside the clicked Telegram message itself (so we survive
    # cold starts and cross-instance callbacks on Vercel).
    inc = get_incident(tok) if tok else None
    source_of_state = "server" if inc else "none"
    clicked_msg = cq.get("message") or {}
    clicked_chat = (clicked_msg.get("chat") or {}).get("id")
    clicked_msg_id = clicked_msg.get("message_id")
    clicked_text = clicked_msg.get("text") or ""
    if not inc:
        snap = _decode_state(clicked_text)
        if snap and snap.get("tok") == tok:
            inc = _incident_from_snapshot(snap)
            if clicked_chat is not None and clicked_msg_id is not None:
                inc["message_targets"] = [
                    {"chat_id": clicked_chat, "message_id": clicked_msg_id}
                ]
            source_of_state = "message"
    if not inc:
        if callback_id:
            tg_answer_callback(callback_id, "Session expired — please re-run CI")
        if clicked_chat is not None:
            try:
                tg_send_with_buttons(
                    clicked_chat,
                    build_expired_message({"repository": ""}),
                    buttons=[],
                )
            except Exception as e:
                print(f"[PipelineMedic] expired-send failed: {e}", flush=True)
        return JSONResponse({"ok": True})

    def _post(new_text: str, buttons: list[list[dict[str, Any]]] | None) -> None:
        """Send a brand-new Telegram message to every recipient of this incident."""
        sent = _broadcast_new_message(inc, new_text, buttons)
        if not sent:
            return
        existing = list(inc.get("message_targets") or [])
        existing.extend(sent)
        inc["message_targets"] = existing
        update_incident(tok, message_targets=existing)

    # Only the initial decision (auto/manual) is gated by the TTL;
    # merge/rollback buttons remain valid once a PR is open.
    if action in ("autofix", "manual") and _is_expired(inc):
        tg_answer_callback(callback_id, "Decision window expired")
        update_incident(tok, status="expired")
        inc["status"] = "expired"
        _post(build_expired_message(inc), [])
        return JSONResponse({"ok": True})

    if action == "manual":
        tg_answer_callback(callback_id, "Marked as manual fix")
        update_incident(tok, status="manual")
        inc["status"] = "manual"
        _post(build_manual_message(inc), [])
        return JSONResponse({"ok": True})

    if action == "autofix":
        if inc.get("status") not in (None, "awaiting_choice"):
            tg_answer_callback(callback_id, "Already handled")
            return JSONResponse({"ok": True})
        tg_answer_callback(callback_id, "Creating fix branch and PR…")
        update_incident(tok, status="creating_pr")
        try:
            analysis_for_pr = dict(inc.get("analysis") or {})
            analysis_for_pr["_incident_token"] = tok
            github_info = maybe_create_autofix_pr(
                inc.get("repository", ""),
                inc.get("repository_full_name"),
                analysis_for_pr,
                "auto_fix",
            )
        except Exception as e:
            github_info = {"ok": False, "mode": "error", "error": str(e)}
        ok = bool(github_info.get("ok") and github_info.get("mode") == "github")
        new_status = "pr_open" if ok else "pr_failed"
        update_incident(tok, github=github_info, status=new_status)
        inc["github"] = github_info
        inc["status"] = new_status
        if ok:
            new_buttons = [
                [
                    {"text": "✅ Merge to main", "callback_data": f"merge:{tok}"},
                    {"text": "↩️ Rollback", "callback_data": f"roll:{tok}"},
                ]
            ]
            _post(build_pr_created_message(inc, github_info), new_buttons)
        else:
            _post(build_pr_failed_message(inc, github_info), [])
        return JSONResponse({"ok": True})

    if action == "merge":
        if inc.get("status") != "pr_open":
            tg_answer_callback(callback_id, "Nothing to merge")
            return JSONResponse({"ok": True})
        tg_answer_callback(callback_id, "Merging…")
        result = merge_pull_request(inc)
        new_status = "merged" if result.get("ok") else "merge_failed"
        update_incident(tok, merge=result, status=new_status)
        inc["status"] = new_status
        _post(build_merged_message(inc, result), [])
        return JSONResponse({"ok": True})

    if action == "roll":
        if inc.get("status") != "pr_open":
            tg_answer_callback(callback_id, "Nothing to roll back")
            return JSONResponse({"ok": True})
        tg_answer_callback(callback_id, "Rolling back…")
        result = rollback_pull_request(inc)
        new_status = "rolled_back" if result.get("ok") else "rollback_failed"
        update_incident(tok, rollback=result, status=new_status)
        inc["status"] = new_status
        _post(build_rollback_message(inc, result), [])
        return JSONResponse({"ok": True})

    tg_answer_callback(callback_id, "Unknown action")
    return JSONResponse({"ok": True})


@app.post("/webhook")
@app.post("/api/webhook")
async def webhook_post(request: Request):
    return await process_webhook(request)


@app.post("/")
async def root_post(request: Request):
    return await process_webhook(request)


@app.post("/telegram/webhook")
@app.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    body = await _parse_body(request)
    if "callback_query" in body:
        return await handle_telegram_callback(body)
    return JSONResponse({"ok": True})


@app.post("/github/webhook")
@app.post("/api/github/webhook")
async def github_repo_webhook_route(request: Request):
    return await handle_github_repo_webhook(request)


@app.get("/incidents/{token}")
async def get_incident_status(token: str):
    inc = get_incident(token)
    if not inc:
        return JSONResponse(status_code=404, content={"detail": "incident not found"})
    safe = {
        k: v
        for k, v in inc.items()
        if k not in ("message_targets",)
    }
    return safe


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000)
