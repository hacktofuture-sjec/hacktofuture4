import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

from llm.client import chat_text


def _extract_json(raw: str) -> str:
    """Robustly extract a JSON object from LLM output (handles markdown fences, prose, etc.)"""
    # Strip markdown fences like ```json ... ``` or ``` ... ```
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fenced:
        return fenced.group(1)
    # Find outermost { ... }
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


def analyze(feedback_texts: list[str], repo_tree: str = "(tree unavailable)") -> dict:
    """
    Analyzer Agent: understand the root issue from clustered user feedback.

    Args:
        feedback_texts: List of raw feedback strings from a cluster
        repo_tree: Newline-separated list of actual file paths in the repo

    Returns:
        Structured analysis dict with issue details
    """
    sample = feedback_texts[:10]
    combined = "\n---\n".join([f"• {t}" for t in sample])

    prompt = f"""You are a senior software engineer analyzing a cluster of user feedback reports.

The following feedback items were automatically grouped together because they describe similar issues:

{combined}

Here is the actual file structure of the repository:
```
{repo_tree}
```

Analyze these reports and respond with a JSON object containing:
- issue_title: A concise, technical title for this issue (max 80 chars)
- issue_type: One of: bug | feature_request | performance | ux | security | docs
- description: A 2-3 sentence technical description of the actual problem
- root_cause: Your hypothesis about what's causing this
- affected_area: Which part of the codebase is likely affected (e.g. "auth module", "API layer", "frontend routing")
- severity: One of: low | medium | high | critical
- suggested_files: A list of 2-5 EXACT file paths from the provided repository file structure that definitely need changes to fix this issue. DO NOT make up generic paths. You must strictly choose paths that exist in the repo_tree provided above.
- user_impact: How this affects users

Return ONLY valid JSON. No markdown, no explanation outside the JSON."""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = chat_text(prompt=prompt, max_tokens=1000, model=os.getenv("ANALYZER_MODEL"))
            cleaned = _extract_json(raw)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"[Analyzer] Attempt {attempt + 1}/3 JSON parse error: {e}")
            last_error = e
        except Exception as e:
            print(f"[Analyzer] Error: {e}")
            raise

    print(f"[Analyzer] All retries failed, using fallback. Last error: {last_error}")
    return {
        "issue_title": "Unstructured Issue",
        "issue_type": "bug",
        "description": combined[:300],
        "root_cause": "Unknown",
        "affected_area": "Unknown",
        "severity": "medium",
        "suggested_files": [],
        "user_impact": "Unknown",
    }
