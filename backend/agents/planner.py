import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

from llm.client import chat_text


def _extract_json(raw: str) -> str:
    """Robustly extract a JSON object from LLM output (handles markdown fences, prose, etc.)"""
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fenced:
        return fenced.group(1)
    start = raw.find("{")
    if start != -1:
        depth = 0
        for i, ch in enumerate(raw[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return raw[start : i + 1]
    return raw


def plan(analysis: dict, repo_context: str, learnings_context: str = "") -> dict:
    """
    Planner Agent: create a detailed fix plan based on the analysis.

    Args:
        analysis: Output from the Analyzer agent
        repo_context: String of relevant file contents from the repo
        learnings_context: Optional string of past successful similar fixes (few-shot)

    Returns:
        Structured plan dict with step-by-step fix strategy
    """
    analysis_str = json.dumps(analysis, indent=2)

    learnings_section = (
        f"\n{learnings_context}\n"
        if learnings_context
        else ""
    )

    prompt = f"""You are a tech lead planning how to fix a software issue.

Issue Analysis:
{analysis_str}

Relevant repository files:
{repo_context[:3000] if repo_context else "(No source files available — plan generically)"}
{learnings_section}
Create a detailed fix plan as a JSON object with:
- summary: One-line summary of the fix approach
- approach: A paragraph explaining the fix strategy and why
- files_to_modify: List of file paths that need changes
- steps: List of specific, actionable steps as strings (e.g. "In src/auth/login.js, add null check for user session before redirecting")
- estimated_complexity: One of: low | medium | high
- risks: List of potential side effects or regression risks
- test_cases: List of test scenarios to validate the fix works
- estimated_lines_changed: Approximate number of lines to change

Return ONLY valid JSON. No markdown."""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = chat_text(prompt=prompt, max_tokens=1200, model=os.getenv("PLANNER_MODEL"))
            cleaned = _extract_json(raw)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"[Planner] Attempt {attempt + 1}/3 JSON parse error: {e}")
            last_error = e
        except Exception as e:
            print(f"[Planner] Error: {e}")
            raise

    print(f"[Planner] All retries failed, using fallback. Last error: {last_error}")
    return {
        "summary": "Generic fix plan",
        "approach": "Apply defensive coding patterns",
        "files_to_modify": analysis.get("suggested_files", []),
        "steps": ["Review and fix affected code"],
        "estimated_complexity": "medium",
        "risks": [],
        "test_cases": [],
        "estimated_lines_changed": 10,
    }
