import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

from llm.client import chat_text


def _extract_json(raw: str) -> str:
    """
    Robustly extract a JSON object from an LLM response that may contain
    markdown fences, leading prose, or trailing commentary.
    """
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


def generate_tests(analysis: dict, patches: list) -> dict:
    """
    Tester Agent: write unit tests for the generated code fix.

    Args:
        analysis: Output from the Analyzer agent
        patches: List of patch objects from the Coder agent

    Returns:
        Dict with test file path, test code, and coverage list
    """
    if not patches:
        # No patches produced — return a meaningful skip stub instead of useless pass
        issue_type = analysis.get("issue_type", "fix")
        return {
            "test_file_path": f"tests/test_{issue_type}.py",
            "test_code": (
                "# Tests skipped — Coder agent produced no patches.\n"
                "# Re-run the pipeline to generate actual tests.\n"
                "import pytest\n\n"
                "@pytest.mark.skip(reason='No code patches were generated')\n"
                "def test_placeholder():\n"
                "    pass\n"
            ),
            "test_cases_covered": [],
            "fixtures_needed": [],
            "run_command": "pytest tests/ -v",
        }

    analysis_str = json.dumps(analysis, indent=2)
    patches_str = json.dumps(patches[:3], indent=2)  # top 3 patches

    prompt = f"""You are a QA engineer. Write comprehensive tests for this code fix.

Issue Analysis:
{analysis_str}

Code patches applied:
{patches_str}

Write pytest-style unit tests that validate the fix. Return a JSON object with:
- test_file_path: Where to place the test file (e.g. "tests/test_auth_fix.py")  
- test_code: Complete, runnable pytest test code as a string
- test_cases_covered: List of test scenario descriptions
- fixtures_needed: List of any external fixtures/mocks needed
- run_command: The command to run the tests (e.g. "pytest tests/test_auth_fix.py -v")

Requirements for test_code:
- Use pytest and standard Python libraries
- Include pytest fixtures where needed
- Mock external dependencies (DB, APIs, etc.)
- Test both success and failure paths
- Include at least one edge case test
- Add docstrings to each test function
- Use descriptive test function names (test_should_...)
- Do NOT use placeholder pass statements — write real assertions

Return ONLY valid JSON. No markdown fences. No prose before or after the JSON."""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = chat_text(prompt=prompt, max_tokens=2500, model=os.getenv("TESTER_MODEL"))
            cleaned = _extract_json(raw)
            result = json.loads(cleaned)

            test_code = result.get("test_code", "")
            # Reject stub responses that are just a pass
            if not test_code.strip() or test_code.strip() in {
                "pass",
                "# Auto-generated tests placeholder\nimport pytest\n\ndef test_placeholder():\n    pass",
            }:
                raise ValueError(f"LLM returned a placeholder test on attempt {attempt + 1}")

            return result

        except (json.JSONDecodeError, ValueError) as e:
            print(f"[Tester] Attempt {attempt + 1}/3 failed: {e}")
            last_error = e
        except Exception as e:
            print(f"[Tester] Error: {e}")
            raise

    # Retries exhausted — return a skip stub so the pipeline can still create the PR
    print(f"[Tester] Could not generate real tests after 3 attempts: {last_error}")
    issue_type = analysis.get("issue_type", "fix")
    return {
        "test_file_path": f"tests/test_{issue_type}.py",
        "test_code": (
            "# Tests could not be auto-generated — LLM parse error.\n"
            "# Please write tests manually for this fix.\n"
            "import pytest\n\n"
            "@pytest.mark.skip(reason='Auto-generation failed — please add tests manually')\n"
            "def test_placeholder():\n"
            "    pass\n"
        ),
        "test_cases_covered": [],
        "fixtures_needed": [],
        "run_command": "pytest tests/ -v",
    }
