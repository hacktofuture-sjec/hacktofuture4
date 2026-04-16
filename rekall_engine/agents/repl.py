"""
REKALL — REPL Environment for RLM Agents

A sandboxed Python exec() environment that provides the programmable
runtime described in the RLM (Recursive Language Models) paper.

The LLM writes code to explore, transform, and reason over a CI/CD log
loaded into the `context` variable. It can:
  - Print slices of context to understand the data
  - Use regex, string ops, collections to search/filter
  - Call llm_query(prompt, context_snippet) to spawn sub-agents
  - Call FINAL(answer) or FINAL_VAR(variable_name) to terminate

The REPL maintains state across exec() calls (like a Jupyter notebook).

Security note: exec() with restricted globals is safe here because the
only input is CI/CD logs — not arbitrary user code. The LLM writes the
code, and we control the sandbox globals/builtins.
"""

from __future__ import annotations

import io
import logging
import re
import json
import collections
import traceback
from contextlib import redirect_stdout, redirect_stderr
from typing import Any, Callable, Dict, List, Optional

log = logging.getLogger("rekall.repl")


class _FinalSignal(Exception):
    """Raised when FINAL() or FINAL_VAR() is called to break the exec loop."""
    def __init__(self, result: Any) -> None:
        self.result = result


class REPLEnvironment:
    """
    Sandboxed Python REPL for RLM agents.

    Creates an isolated namespace pre-loaded with:
      - `context` — the CI/CD log string
      - `llm_query(prompt, context_snippet?)` — spawn a sub-agent
      - `FINAL(answer)` — terminate with an answer string
      - `FINAL_VAR(var_name)` — terminate with a variable from the namespace
      - Safe builtins: len, print, range, sorted, enumerate, re, json, etc.
    """

    def __init__(
        self,
        context: str,
        llm_query_fn: Optional[Callable] = None,
        max_output: int = 20_000,
    ) -> None:
        self._context = context
        self._llm_query_fn = llm_query_fn
        self._max_output = max_output
        self._done = False
        self._result: Any = None
        self._namespace: Dict[str, Any] = {}
        self._init_namespace()

    def _init_namespace(self) -> None:
        """Set up the sandboxed namespace with safe builtins and RLM functions."""

        def _final(answer: Any) -> None:
            """Terminate the RLM loop and return `answer` as the result."""
            raise _FinalSignal(answer)

        def _final_var(var_name: str) -> None:
            """Terminate the RLM loop and return the variable `var_name` from the namespace."""
            if var_name not in self._namespace:
                raise NameError(f"Variable '{var_name}' not found in namespace")
            raise _FinalSignal(self._namespace[var_name])

        def _llm_query(prompt: str, context_snippet: str | None = None) -> str:
            """
            Call a sub-agent LLM with the given prompt and optional context snippet.
            Returns the sub-agent's answer as a string variable.
            """
            if self._llm_query_fn is None:
                return "[llm_query unavailable — no LLM callback configured]"
            return self._llm_query_fn(prompt, context_snippet)

        # Safe builtins — no file I/O, no imports, no exec
        safe_builtins = {
            # Types
            "True": True,
            "False": False,
            "None": None,
            "int": int,
            "float": float,
            "str": str,
            "bool": bool,
            "list": list,
            "dict": dict,
            "set": set,
            "tuple": tuple,
            "type": type,
            "bytes": bytes,
            # Functions
            "len": len,
            "range": range,
            "enumerate": enumerate,
            "zip": zip,
            "map": map,
            "filter": filter,
            "sorted": sorted,
            "reversed": reversed,
            "min": min,
            "max": max,
            "sum": sum,
            "abs": abs,
            "round": round,
            "any": any,
            "all": all,
            "isinstance": isinstance,
            "issubclass": issubclass,
            "hasattr": hasattr,
            "getattr": getattr,
            "setattr": setattr,
            "print": print,  # captured via redirect_stdout
            "repr": repr,
            "hash": hash,
            "id": id,
            "chr": chr,
            "ord": ord,
            "hex": hex,
            "oct": oct,
            "bin": bin,
            "format": format,
            "iter": iter,
            "next": next,
            "callable": callable,
            "input": lambda *_: "",  # no-op
            "__import__": self._restricted_import,
        }

        self._namespace = {
            "__builtins__": safe_builtins,
            # RLM core
            "context": self._context,
            "llm_query": _llm_query,
            "FINAL": _final,
            "FINAL_VAR": _final_var,
            # Pre-imported safe modules
            "re": re,
            "json": json,
            "collections": collections,
            "Counter": collections.Counter,
            "defaultdict": collections.defaultdict,
            "OrderedDict": collections.OrderedDict,
            "math": __import__("math"),
            "datetime": __import__("datetime"),
            "itertools": __import__("itertools"),
        }

    def _restricted_import(self, name: str, *args: Any, **kwargs: Any) -> Any:
        """Only allow importing a whitelist of safe modules."""
        allowed = {"re", "json", "collections", "math", "statistics", "itertools", "functools", "textwrap", "string", "datetime", "heapq", "bisect"}
        if name in allowed:
            import importlib
            return importlib.import_module(name)
        raise ImportError(f"Import of '{name}' is not allowed in the RLM sandbox")

    def execute(self, code: str) -> str:
        """
        Execute a code block in the persistent namespace.
        Returns captured stdout (truncated to max_output chars).
        If FINAL() or FINAL_VAR() is called, sets self._done = True.
        """
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, self._namespace)
        except _FinalSignal as sig:
            self._done = True
            self._result = sig.result
            output = stdout_capture.getvalue()
            return self._truncate(output + f"\n[FINAL] Result captured successfully.")
        except Exception as exc:
            # Return the error so the LLM can see it and self-correct
            tb = traceback.format_exc()
            output = stdout_capture.getvalue()
            error_output = f"{output}\n[ERROR] {type(exc).__name__}: {exc}\n{tb}"
            return self._truncate(error_output)

        output = stdout_capture.getvalue()
        stderr_output = stderr_capture.getvalue()
        if stderr_output:
            output += f"\n[STDERR] {stderr_output}"
        return self._truncate(output)

    def is_done(self) -> bool:
        """True if FINAL() or FINAL_VAR() was called."""
        return self._done

    def get_result(self) -> Any:
        """Return the final result set by FINAL() or FINAL_VAR()."""
        return self._result

    def get_metadata(self) -> Dict[str, Any]:
        """Return metadata about the context for the LLM's first message."""
        ctx = self._context
        head = ctx[:500] if len(ctx) > 500 else ctx
        tail = ctx[-500:] if len(ctx) > 500 else ""

        return {
            "type": type(ctx).__name__,
            "length_chars": len(ctx),
            "length_lines": ctx.count("\n") + 1,
            "head_500": head,
            "tail_500": tail,
        }

    def _truncate(self, output: str) -> str:
        """Truncate output if it exceeds max_output chars."""
        if len(output) <= self._max_output:
            return output
        half = self._max_output // 2
        return (
            output[:half]
            + f"\n\n... [TRUNCATED — output was {len(output)} chars, "
            f"showing first and last {half} chars] ...\n\n"
            + output[-half:]
        )
