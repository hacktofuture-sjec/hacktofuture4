import os
import re
import json
from dotenv import load_dotenv

load_dotenv()

from llm.client import chat_text


def _extract_json(raw: str) -> str:
    """Robustly extract a JSON object from LLM output."""
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


def apply_patch_to_file(original: str, find: str, replace: str) -> str | None:
    """
    Apply a search-and-replace patch to a file's content.
    Returns the patched content, or None if `find` was not found.
    Tries exact match first, then whitespace-normalised match.
    """
    if find in original:
        return original.replace(find, replace, 1)

    # Fallback: normalise leading whitespace per line and try again
    def normalise(s: str) -> str:
        return "\n".join(line.rstrip() for line in s.splitlines())

    norm_orig = normalise(original)
    norm_find = normalise(find)
    if norm_find in norm_orig:
        idx = norm_orig.index(norm_find)
        return original[:idx] + replace + original[idx + len(find):]

    return None  # patch cannot be applied


def generate_code(plan: dict, file_contents: dict) -> dict:
    """
    Coder Agent: generate search-and-replace patches for the bug fix.

    Strategy: instead of rewriting entire files (which small models do poorly),
    the LLM only writes the buggy snippet and its replacement.
    We apply the replacement programmatically, preserving all original code.

    Args:
        plan: Output from the Planner agent
        file_contents: Dict of {file_path: file_content} for relevant files

    Returns:
        Dict with patches list, each patch having:
          - file_path, find, replace, change_summary
          - new_code: the fully-patched file (computed here, not by the LLM)
    """
    plan_str = json.dumps(plan, indent=2)

    if file_contents:
        files_str = "\n\n".join([
            f"=== FILE: {path} ===\n{content[:3000]}"
            for path, content in file_contents.items()
        ])
    else:
        files_str = "(No source files available — write a new minimal fix file)"

    prompt = f"""You are an expert software developer fixing a bug in an existing codebase.

Fix Plan:
{plan_str}

ORIGINAL FILE CONTENTS (read these carefully — you must fix the actual code below):
{files_str}

Your task: identify the exact buggy code and provide the corrected replacement.

Return a JSON object with:
- patches: list of objects, one per file that needs changing. Each object has:
  - file_path: exact file path (must be one of the file paths shown above)
  - find: the EXACT buggy code snippet to search for (copy it character-for-character from the file above, including indentation). This should be the SMALLEST snippet that uniquely identifies the bug — usually 1-5 lines.
  - replace: the corrected replacement for that snippet only (same indentation style)
  - change_summary: one-line description of what changed
- explanation: brief technical explanation of the fix
- breaking_changes: list of breaking changes introduced (empty list if none)

RULES:
- `find` must be text that appears VERBATIM in the original file shown above.
- `replace` should only change what's needed to fix the bug — leave everything else intact.
- Do NOT rewrite entire files. Only target the specific buggy lines.
- The patches list MUST have at least one entry.

Return ONLY valid JSON. No markdown fences. No prose before or after."""

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = chat_text(prompt=prompt, max_tokens=2000, model=os.getenv("CODER_MODEL"))
            cleaned = _extract_json(raw)
            result = json.loads(cleaned)

            patches = result.get("patches", [])

            # Validate and apply patches to get new_code
            valid_patches = []
            for p in patches:
                file_path = p.get("file_path", "").lstrip("/")
                find_str = p.get("find", "")
                replace_str = p.get("replace", "")

                if not file_path or not find_str:
                    print(f"[Coder] Skipping patch with missing file_path or find: {p}")
                    continue

                original = file_contents.get(file_path) or file_contents.get("/" + file_path)

                if original is None:
                    # Model may have used wrong path — try fuzzy match
                    for known_path, content in file_contents.items():
                        if known_path.endswith(file_path) or file_path.endswith(known_path.split("/")[-1]):
                            original = content
                            file_path = known_path
                            print(f"[Coder] Fuzzy-matched path '{p['file_path']}' → '{file_path}'")
                            break

                if original is not None:
                    patched = apply_patch_to_file(original, find_str, replace_str)
                    if patched is None:
                        print(f"[Coder] ⚠️  Could not find snippet in {file_path}, skipping patch")
                        print(f"[Coder] Snippet was: {find_str[:100]!r}")
                        continue
                    new_code = patched
                    print(f"[Coder] ✅ Applied patch to {file_path}")
                else:
                    # No original file fetched — use replace as the entire new file
                    new_code = replace_str
                    print(f"[Coder] ⚠️  No original for {file_path} — using replace as full content")

                valid_patches.append({
                    "file_path": file_path,
                    "find": find_str,
                    "replace": replace_str,
                    "new_code": new_code,
                    "change_summary": p.get("change_summary", "auto-fix"),
                })

            if not valid_patches:
                raise ValueError(
                    f"No valid patches could be applied on attempt {attempt + 1}. "
                    f"LLM response excerpt: {raw[:400]}"
                )

            result["patches"] = valid_patches
            return result

        except (json.JSONDecodeError, ValueError) as e:
            print(f"[Coder] Attempt {attempt + 1}/3 failed: {e}")
            last_error = e
        except Exception as e:
            print(f"[Coder] Unexpected error: {e}")
            raise

    raise RuntimeError(
        f"Coder agent could not generate valid patches after 3 attempts. "
        f"Last error: {last_error}"
    )
