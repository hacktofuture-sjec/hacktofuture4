"""
REKALL — RLM Engine (Recursive Language Model)

A complete implementation of the RLM inference paradigm from the MIT paper.
The LLM interacts with CI/CD failure logs through a Python REPL environment,
writing code to explore, decompose, and reason about the log data.

Key concepts:
  - The CI/CD log is loaded into a `context` variable in the REPL
  - The LLM writes code to peek at slices, regex-search, filter
  - It can call llm_query() to spawn sub-agents for subtasks
  - Sub-agent results are returned as REPL variables (symbolic returns)
  - Auto-generated or constructed answers via FINAL()/FINAL_VAR()

This replaces the old 2-call Zoom & Scan approach with a genuine
RLM loop that can handle arbitrarily long CI/CD logs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional

from .repl import REPLEnvironment
from ..config import engine_config
from ..groq_pool import get_pool
from ..types import FailureObject, FixSuggestion, FixDetail

log = logging.getLogger("rekall.rlm")


# ── System prompt (adapted from RLM paper for CI/CD domain) ──────────────────

_RLM_SYSTEM_PROMPT = """\
You are REKALL-RLM, a recursive language model agent specializing in CI/CD \
failure diagnosis and fix synthesis. You operate inside a Python REPL environment.

## Your Environment

You have access to these pre-loaded variables and functions:

- `context` — A string containing the full CI/CD failure log. It may be very \
long (1M+ tokens). Do NOT try to read it all at once via print.
- `llm_query(prompt, context_snippet=None)` — Spawn a sub-agent LLM to process \
a specific subtask. The sub-agent gets its own REPL with `context_snippet` \
(or the full context if None). Returns the sub-agent's answer as a string variable in the REPL. \
Use this for high-density extraction or classification of 200k+ character chunks.
- `FINAL(answer)` — Call this with your final answer (a dict) to terminate.
- `FINAL_VAR(variable_name)` — Call this with a variable name from the REPL to return it.

## Recursive Reasoning Framework (Observation-derived Rules)

1. **Strategic Peeking (Initialization):** Always start by printing `len(context)`, \
`context[:1000]`, and `context[-1000:]`. This gives you the "head" and "tail" \
metadata without saturating your context window.

2. **Regex Filtering (Search):** Use `re.findall()` or `re.search()` to identify \
"needles" (error codes, stack traces) before attempting semantic reasoning. \
Print only the matches, not the surrounding context.

3. **Map-Reduce Parallelism (Scale):** If you identify multiple points of interest, \
you can spawn multiple `llm_query` sub-calls to process them. 

4. **Model-as-CPU:** Treat the REPL as your external heap memory. Load intermediate \
results into variables rather than raw text in your history.

## CI/CD Failure Analysis

Produce a dict with:
```python
{
    "root_cause": "one-line description of the root cause",
    "fix_description": "what needs to be done to fix this",
    "fix_commands": ["list", "of", "shell", "commands", "to", "fix"],
    "confidence": 0.0,  # float 0.0 - 1.0
    "reasoning": "step-by-step logic used in your REPL analysis"
}
```

## Constraints
- Write ONE code block per turn. Wait for execution output.
- Use `llm_query` for large chunks (200k+) to avoid "context rot".
- If you encounter a Python error, fix your regex or indexing in the next turn.
"""

_SUB_AGENT_SYSTEM_PROMPT = """\
You are a REKALL sub-agent. You have been given a specific piece of a CI/CD \
failure log to analyze. Your task is described in the user message.

You have access to the same REPL environment as the parent agent:
- `context` — The specific log section you need to analyze
- `re`, `json`, `collections` — Available modules
- `FINAL(answer)` — Call this with your answer when done
- `FINAL_VAR(var_name)` — Alternative way to return a result

Work efficiently. Analyze the context, find the answer, and call FINAL().
Do NOT call llm_query() — you cannot spawn further sub-agents.
"""


class RLMEngine:
    """
    Recursive Language Model engine with REPL environment.

    Replaces the old 2-call Zoom & Scan with a genuine RLM loop:
    1. Initialize REPL with the CI/CD log as `context`
    2. Send metadata (length, head/tail) to the LLM
    3. LLM writes code → execute → read stdout → repeat
    4. On llm_query() → spawn sub-agent with isolated REPL
    5. On FINAL()/FINAL_VAR() → extract result, build FixSuggestion
    """

    def __init__(self) -> None:
        pass  # client handled by groq_pool

    # ── Public API ────────────────────────────────────────────────────────────

    async def reason(self, failure: FailureObject) -> FixSuggestion:
        """
        Run the RLM loop to analyze a CI/CD failure and produce a fix.

        Args:
            failure: FailureObject with error_type, error_message, full_log

        Returns:
            FixSuggestion with fix details and RLM trace
        """
        trace_list: List[Dict[str, Any]] = []
        context = self._build_context(failure)

        log.info(
            "[rlm] starting RLM loop for failure_id=%s, context=%d chars",
            failure.failure_id, len(context),
        )

        try:
            result = await self._run_agent(
                context=context,
                task=f"Analyze this {failure.error_type} CI/CD failure and produce a fix.\n"
                     f"Error: {failure.error_message}",
                depth=0,
                model=engine_config.rlm_model,
                trace_list=trace_list,
            )
        except Exception as exc:
            log.error("[rlm] RLM loop failed: %s", exc, exc_info=True)
            result = {
                "root_cause": f"RLM analysis failed: {exc}",
                "fix_description": "Manual investigation required",
                "fix_commands": [],
                "confidence": 0.1,
                "reasoning": f"The RLM engine encountered an error: {exc}",
            }

        return self._build_suggestion(failure.failure_id, result, trace_list)

    # ── Agent loop (recursive for sub-agents) ─────────────────────────────────

    async def _run_agent(
        self,
        context: str,
        task: str,
        depth: int = 0,
        model: Optional[str] = None,
        trace_list: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Single RLM agent loop. Each iteration:
        1. Send messages to LLM
        2. Extract code from response
        3. Execute code in REPL
        4. Append code + output to messages
        5. Check if FINAL() was called → return result
        6. Repeat until max_steps
        """
        max_steps = engine_config.rlm_max_steps
        max_depth = engine_config.rlm_max_depth

        is_root = depth == 0
        agent_id = f"{'root' if is_root else f'sub-d{depth}'}-{uuid.uuid4().hex[:6]}"

        log.info("[rlm] agent %s starting (depth=%d)", agent_id, depth)

        # Create sub-agent llm_query callback (disabled at max depth)
        def llm_query_sync(prompt: str, context_snippet: str | None = None) -> str:
            if depth >= max_depth:
                return (
                    f"[ERROR] Maximum recursion depth ({max_depth}) reached. "
                    "You must solve this task without calling llm_query()."
                )
            sub_context = context_snippet or context
            sub_model = engine_config.rlm_subagent_model
            try:
                loop = asyncio.get_running_loop()
                future = asyncio.run_coroutine_threadsafe(
                    self._run_agent(sub_context, prompt, depth + 1, model=sub_model, trace_list=trace_list),
                    loop
                )
                import concurrent.futures
                try:
                    sub_result = future.result(timeout=60)
                except concurrent.futures.TimeoutError:
                    return "[ERROR] sub-agent timed out after 60s"
            except RuntimeError:
                sub_result = asyncio.run(
                    self._run_agent(sub_context, prompt, depth + 1, model=sub_model, trace_list=trace_list)
                )
            # Return as string (symbolic return — not loaded into parent context)
            if isinstance(sub_result, dict):
                return json.dumps(sub_result, indent=2)
            return str(sub_result)

        # Initialize REPL
        repl = REPLEnvironment(
            context=context,
            llm_query_fn=llm_query_sync if depth < max_depth else None,
            max_output=engine_config.rlm_output_truncation,
        )

        # Run initialization code (metadata peek)
        metadata = repl.get_metadata()
        init_output = (
            f"=== REPL Environment Initialized ===\n"
            f"context type: {metadata['type']}\n"
            f"context length: {metadata['length_chars']} chars, "
            f"{metadata['length_lines']} lines\n"
            f"--- First 500 chars ---\n{metadata['head_500']}\n"
        )
        if metadata["tail_500"]:
            init_output += f"--- Last 500 chars ---\n{metadata['tail_500']}\n"

        # Build initial messages
        system = _RLM_SYSTEM_PROMPT if is_root else _SUB_AGENT_SYSTEM_PROMPT
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Task: {task}\n\n{init_output}"},
        ]

        if trace_list is not None:
            trace_list.append({
                "agent_id": agent_id,
                "depth": depth,
                "step": 0,
                "type": "init",
                "output": init_output[:2000],
            })

        # Main REPL loop
        for step in range(1, max_steps + 1):
            log.debug("[rlm] agent %s step %d/%d", agent_id, step, max_steps)

            # 1. Call LLM to get code
            try:
                llm_response = await self._call_llm(messages)
            except Exception as exc:
                log.error("[rlm] LLM call failed at step %d: %s", step, exc)
                if trace_list is not None:
                    trace_list.append({
                        "agent_id": agent_id,
                        "depth": depth,
                        "step": step,
                        "type": "error",
                        "error": f"LLM call failed: {exc}",
                    })
                break

            # 2. Extract code from response
            code = self._extract_code(llm_response)
            if not code:
                log.warning("[rlm] no code extracted at step %d", step)
                # Ask the LLM to write code
                messages.append({"role": "assistant", "content": llm_response})
                messages.append({
                    "role": "user",
                    "content": (
                        "You must write Python code to interact with the REPL. "
                        "Wrap your code in ```python ... ``` blocks. "
                        "When you have your answer, call FINAL(your_dict)."
                    ),
                })
                continue

            # 3. Execute in REPL
            log.debug("[rlm] executing code:\n%s", code[:200])
            output = repl.execute(code)

            # 4. Record trace
            if trace_list is not None:
                trace_list.append({
                    "agent_id": agent_id,
                    "depth": depth,
                    "step": step,
                    "type": "code",
                    "code": code,
                    "output": output[:2000],
                    "done": repl.is_done(),
                })

            # 5. Check if done
            if repl.is_done():
                result = repl.get_result()
                log.info("[rlm] agent %s finished at step %d", agent_id, step)
                if isinstance(result, dict):
                    return result
                # If result is not a dict, wrap it
                return {
                    "root_cause": str(result),
                    "fix_description": str(result),
                    "fix_commands": [],
                    "confidence": 0.5,
                    "reasoning": f"RLM returned: {result}",
                }

            # 6. Append code + output to messages for next iteration
            messages.append({"role": "assistant", "content": f"```python\n{code}\n```"})
            messages.append({"role": "user", "content": f"Output:\n```\n{output}\n```"})

        # Max steps reached without FINAL()
        log.warning("[rlm] agent %s hit max_steps=%d without FINAL()", agent_id, max_steps)

        # Force a final call
        force_prompt = (
            "You've reached the maximum number of steps. "
            "You MUST call FINAL() now with whatever analysis you have. "
            "Construct a result dict and call FINAL(result)."
        )
        messages.append({"role": "user", "content": force_prompt})

        try:
            llm_response = await self._call_llm(messages)
            code = self._extract_code(llm_response)
            if code:
                output = repl.execute(code)
                if trace_list is not None:
                    trace_list.append({
                        "agent_id": agent_id,
                        "depth": depth,
                        "step": max_steps + 1,
                        "type": "forced_final",
                        "code": code,
                        "output": output[:2000],
                    })
                if repl.is_done():
                    result = repl.get_result()
                    if isinstance(result, dict):
                        return result
        except Exception as exc:
            log.warning("[rlm] agent %s forced-final error: %s", agent_id, exc)

        # Absolute fallback
        return {
            "root_cause": "Analysis incomplete — max REPL steps reached",
            "fix_description": "Manual investigation required",
            "fix_commands": [],
            "confidence": 0.15,
            "reasoning": "The RLM agent exhausted its step budget without reaching a conclusion.",
        }

    # ── LLM calling ──────────────────────────────────────────────────────────

    async def _call_llm(self, messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
        """Call Groq via the key-rotation pool and return the raw text response."""
        target_model = model or engine_config.rlm_model
        return await get_pool().call(
            model=target_model,
            messages=messages,
            max_tokens=2048,
            temperature=0.1,
        )

    # ── Code extraction ──────────────────────────────────────────────────────

    @staticmethod
    def _extract_code(response: str) -> str | None:
        """
        Extract Python code from an LLM response.
        Looks for ```python ... ``` blocks first, then ```...``` blocks.
        """
        # Try python-tagged blocks first
        python_blocks = re.findall(
            r"```python\s*\n(.*?)```",
            response,
            re.DOTALL,
        )
        if python_blocks:
            return "\n".join(python_blocks)

        # Try generic code blocks
        generic_blocks = re.findall(
            r"```\s*\n(.*?)```",
            response,
            re.DOTALL,
        )
        if generic_blocks:
            return "\n".join(generic_blocks)

        # Try to detect bare code (lines that look like Python)
        lines = response.strip().split("\n")
        code_lines = [
            line for line in lines
            if line.strip() and not line.strip().startswith("#")
            and (
                "=" in line or "print(" in line or "import " in line
                or line.strip().startswith("for ") or line.strip().startswith("if ")
                or line.strip().startswith("def ") or line.strip().startswith("FINAL")
                or line.strip().startswith("result") or line.strip().startswith("llm_query")
            )
        ]
        if code_lines:
            return "\n".join(code_lines)

        return None

    # ── Context building ─────────────────────────────────────────────────────

    @staticmethod
    def _build_context(failure: FailureObject) -> str:
        """Build the context string from a FailureObject."""
        parts = [
            f"=== CI/CD Failure Report ===",
            f"Failure ID: {failure.failure_id}",
            f"Error Type: {failure.error_type}",
            f"Error Message: {failure.error_message}",
            f"",
            f"=== Full Log ===",
        ]
        if failure.full_log:
            max_chars = engine_config.rlm_max_log_chars
            log_text = failure.full_log[:max_chars]
            if len(failure.full_log) > max_chars:
                log_text += f"\n\n[LOG TRUNCATED — {len(failure.full_log)} total chars, showing first {max_chars}]"
            parts.append(log_text)
        else:
            parts.append(failure.error_message)

        return "\n".join(parts)

    # ── Result building ──────────────────────────────────────────────────────

    def _build_suggestion(
        self,
        failure_id: str,
        result: Dict[str, Any],
        trace_list: List[Dict[str, Any]],
    ) -> FixSuggestion:
        """Convert the RLM result dict into a FixSuggestion."""
        fix_detail = FixDetail(
            fix_id=f"rlm-{uuid.uuid4().hex[:8]}",
            source="llm",
            summary=result.get("fix_description", "RLM-generated fix"),
            steps=result.get("fix_commands", []),
            confidence=result.get("confidence", 0.5),
            reasoning=result.get("reasoning", ""),
            matched_incident=None,
        )

        # Build RLM trace entries for the frontend
        rlm_trace = []
        for entry in trace_list:
            rlm_trace.append({
                "depth": entry.get("depth", 0),
                "step": entry.get("step", 0),
                "agent_id": entry.get("agent_id", ""),
                "type": entry.get("type", ""),
                "code": entry.get("code", "")[:500],
                "output": entry.get("output", "")[:500],
            })

        return FixSuggestion(
            failure_id=failure_id,
            suggested_fix=fix_detail,
            alternatives=[],
            context_used=len(trace_list),
            rlm_trace=rlm_trace,
        )
