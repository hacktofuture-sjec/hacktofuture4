"""
REKALL — DiagnosticAgent

Builds a DiagnosticBundle from a FailureEvent:
  1. Extract log excerpt and git diff from the raw payload
  2. Use Claude to compress context into a structured failure_signature and
     context_summary suitable for vault similarity search
  3. Produce a compact failure_signature string as a search key

The embedding field is left empty here (filled by VaultStore at search time
if ChromaDB is available; not required for the core pipeline to function).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .base import BaseAgent
from ..types import DiagnosticBundle, FailureEvent, FailureObject, AgentLogEntry

log = logging.getLogger("rekall.diagnostic")

_SIGNATURE_SYSTEM = """\
You are REKALL's diagnostic engine. Given a CI/CD failure log and metadata,
extract a compact failure signature and a one-paragraph context summary.

The failure_signature MUST follow this exact format: "{type}:{component}:{error_code}"
Examples:
  - "infra:postgres:econnrefused"
  - "oom:java:heapspace"
  - "test:jest:assertion_error"
  - "deploy:image:pull_backoff"
  - "security:secret:api_key_exposed"

Return ONLY valid JSON with exactly these keys:
{
  "failure_signature": "<type>:<component>:<error_code>",
  "context_summary": "<1-2 sentence human-readable summary of what failed and why>"
}
Do not include markdown fences or extra text."""

# ── Signature normalizer ──────────────────────────────────────────────────────
# Maps keywords found in free-form LLM signatures to our canonical format.
# This ensures vault lookups succeed even if the LLM uses slightly different wording.

_NORMALIZATION_MAP: list[tuple[list[str], str]] = [
    # infra patterns
    (["postgres", "econnrefused", "5432", "connection refused"],  "infra:postgres:econnrefused"),
    (["redis", "connection refused", "6379"],                       "infra:redis:econnrefused"),
    (["database", "timeout"],                                        "infra:database:timeout"),
    # OOM patterns
    (["heapspace", "java", "heap space"],                           "oom:java:heapspace"),
    (["oomkilled", "oom-kill", "out of memory"],                    "oom:container:oomkilled"),
    # Test patterns
    (["jest", "assertion"],                                          "test:jest:assertion_error"),
    (["pytest", "assertion"],                                        "test:pytest:assertion_error"),
    (["test", "failed"],                                             "test:ci:test_failure"),
    # Deploy patterns
    (["imagepullbackoff", "image pull", "pull_backoff"],            "deploy:image:pull_backoff"),
    (["kubectl", "deployment"],                                      "deploy:kubernetes:rollout_failed"),
    # Security patterns
    (["secret", "api_key", "credential", "token", "leak"],         "security:secret:api_key_exposed"),
]


class DiagnosticAgent(BaseAgent):
    name = "diagnostic"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input:
          state["failure_event"]  — FailureEvent
          state["failure_object"] — FailureObject (optional, adds full_log)

        Output:
          state["diagnostic_bundle"] — DiagnosticBundle
        """
        event: FailureEvent = state["failure_event"]
        failure_obj: FailureObject | None = state.get("failure_object")

        incident_id = event.id
        payload = event.raw_payload

        # ── Extract raw artifacts ──────────────────────────────────────────────
        log_excerpt = self._extract_log(payload, failure_obj)
        git_diff    = self._extract_diff(payload)
        test_report = self._extract_test_report(payload)

        # ── LLM: build failure_signature + context_summary ───────────────────
        prompt = self._build_prompt(event, log_excerpt, git_diff, test_report)
        try:
            raw = await self.call_llm(prompt, system=_SIGNATURE_SYSTEM, max_tokens=512)
            parsed = self._parse_json(raw)
            raw_sig = parsed.get("failure_signature", f"{event.failure_type}:unknown")
            context_summary = parsed.get("context_summary", log_excerpt[:200])
            # Normalize LLM signature to structured canonical format
            failure_signature = self._normalize_signature(
                raw_sig, event.failure_type, log_excerpt
            )
        except Exception as exc:
            log.warning("[diagnostic] LLM parse failed: %s — using heuristic", exc)
            failure_signature = self._heuristic_normalized_sig(event.failure_type, payload)
            context_summary   = log_excerpt[:300] or f"{event.failure_type} failure detected"

        bundle = DiagnosticBundle(
            incident_id=incident_id,
            failure_type=event.failure_type,
            failure_signature=failure_signature,
            log_excerpt=log_excerpt,
            git_diff=git_diff,
            test_report=test_report,
            context_summary=context_summary,
            metadata={"branch": str(payload.get("branch", ""))},
        )

        log.info(
            "[diagnostic] incident=%s sig=%r summary=%r",
            incident_id,
            failure_signature[:60],
            context_summary[:80],
        )

        state.setdefault("agent_logs", []).append(
            AgentLogEntry(
                incident_id=incident_id,
                step_name="diagnostic",
                status="done",
                detail=context_summary[:120],
            )
        )

        state["diagnostic_bundle"] = bundle
        return state

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _extract_log(
        self,
        payload: dict[str, Any],
        failure_obj: FailureObject | None,
    ) -> str:
        if failure_obj and failure_obj.full_log:
            return failure_obj.full_log[:8000]
        for key in ("log_excerpt", "error_log", "output", "logs", "message"):
            val = payload.get(key)
            if val and isinstance(val, str):
                return val[:8000]
        # GitHub nested
        if isinstance(payload.get("workflow_run"), dict):
            wr = payload["workflow_run"]
            return (
                f"Workflow: {wr.get('name', '')}\n"
                f"Branch: {wr.get('head_branch', '')}\n"
                f"Conclusion: {wr.get('conclusion', '')}\n"
                f"URL: {wr.get('html_url', '')}"
            )
        return str(payload.get("description", ""))[:2000]

    def _extract_diff(self, payload: dict[str, Any]) -> str | None:
        val = payload.get("git_diff") or payload.get("diff")
        return str(val)[:4000] if val else None

    def _extract_test_report(self, payload: dict[str, Any]) -> str | None:
        val = payload.get("test_report") or payload.get("test_output")
        return str(val)[:2000] if val else None

    def _build_prompt(
        self,
        event: FailureEvent,
        log_excerpt: str,
        git_diff: str | None,
        test_report: str | None,
    ) -> str:
        parts = [
            f"Source: {event.source}",
            f"Failure type: {event.failure_type}",
            f"Log excerpt:\n{log_excerpt[:4000]}",
        ]
        if git_diff:
            parts.append(f"Git diff:\n{git_diff[:1500]}")
        if test_report:
            parts.append(f"Test report:\n{test_report[:1000]}")
        return "\n\n".join(parts)

    def _parse_json(self, raw: str) -> dict[str, str]:
        # Strip markdown fences if present
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        return json.loads(cleaned)

    def _normalize_signature(self, raw_sig: str, failure_type: str, log_text: str) -> str:
        """
        Map a free-form LLM signature to the canonical structured format.
        Tries keyword matching first, then falls back to type-based heuristic.
        """
        combined = (raw_sig + " " + log_text[:2000]).lower()

        # Check if the LLM already produced structured format
        if re.match(r'^[a-z]+:[a-z0-9_]+:[a-z0-9_]+$', raw_sig.strip()):
            return raw_sig.strip().lower()

        # Check normalization map
        for keywords, canonical in _NORMALIZATION_MAP:
            if all(kw in combined for kw in keywords[:1]) and any(kw in combined for kw in keywords):
                return canonical

        # Fallback: build heuristic from failure_type + first meaningful keyword
        return self._heuristic_normalized_sig(failure_type, {})

    def _heuristic_normalized_sig(self, failure_type: str, payload: dict) -> str:
        """Build a best-effort structured signature from failure type."""
        type_defaults = {
            "infra":    "infra:unknown:connection_error",
            "oom":      "oom:container:oomkilled",
            "test":     "test:ci:test_failure",
            "deploy":   "deploy:kubernetes:rollout_failed",
            "security": "security:secret:api_key_exposed",
            "unknown":  "unknown:unknown:unknown",
        }
        return type_defaults.get(failure_type, f"{failure_type}:unknown:unknown")

    def _heuristic_sig(self, payload: dict[str, Any]) -> str:
        """Legacy fallback: use first meaningful string value as sig."""
        for key in ("description", "error_log", "message", "log_excerpt"):
            val = payload.get(key, "")
            if val:
                words = str(val).split()[:8]
                return " ".join(words)
        return "unknown_failure"
