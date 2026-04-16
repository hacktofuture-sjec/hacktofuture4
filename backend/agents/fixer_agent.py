"""
Fixer Agent – Generates actionable remediation scripts based on diagnosis.
"""
import json
import logging
import re
import time
from google import genai

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.chat_models import ChatOllama
from langchain_mistralai import ChatMistralAI

from backend.config import settings
from backend.agents.vector_store import VectorStore

logger = logging.getLogger(__name__)


FIXER_SYSTEM_PROMPT = """You are PipeGenie's Fixer Agent — an expert DevOps AI that generates
safe, executable remediation scripts for CI/CD pipeline failures.

Given a diagnosis, generate a precise fix. Output ONLY valid JSON:
{
  "fix_type": "dependency|config|patch|build|test|permissions|network",
  "fix_description": "1-2 sentence human-readable fix description",
  "fix_script": "#!/bin/bash\\n# exact commands to fix the issue",
  "pre_conditions": ["condition 1 to verify before running"],
  "post_conditions": ["what to verify after fix"],
  "estimated_risk": 0.2,
  "requires_restart": false,
  "rollback_script": "#!/bin/bash\\n# commands to undo the fix if needed"
}

Rules:
- Scripts must be safe and idempotent (can run multiple times safely)
- Use conditional checks before making changes (e.g., `if ! command -v xyz; then ...`)
- Never delete production data
- Always include error handling with `set -e`
- Prefer additive changes over replacements
- Only modify files inside the checked-out repository workspace
- Do not use absolute system paths like /etc, /var, /usr
- Do not require sudo; assume CI container context without privileged escalation
- Avoid commands that mutate host runtime outside repository contents"""


class FixerAgent:
    def __init__(self):
        self.vector_store = VectorStore()
        self._init_llm()

    def _resolve_provider(self) -> str:
        provider = (settings.LLM_PROVIDER or "").strip().lower()
        if provider:
            return provider
        if settings.USE_OLLAMA:
            return "ollama"
        if settings.MISTRAL_API_KEY:
            return "mistral"
        return "gemini"

    def _init_llm(self):
        self.provider = self._resolve_provider()
        self.last_provider_used = self.provider
        self.llm = None
        self.gemini_client = None
        self.ollama_fallback_llm = None

        if self.provider == "gemini":
            client_kwargs = {}
            if settings.GEMINI_API_KEY:
                client_kwargs["api_key"] = settings.GEMINI_API_KEY
            self.gemini_client = genai.Client(**client_kwargs)
            # Keep a local Ollama fallback so quota/rate limits don't force rule-based fixes.
            self.ollama_fallback_llm = ChatOllama(
                model=settings.LLM_MODEL,
                base_url=settings.OLLAMA_BASE_URL,
                temperature=0.2,
                format="json"
            )
            logger.info(f"[FixerAgent] Using Gemini model: {settings.GEMINI_MODEL}")
        elif self.provider == "ollama":
            self.llm = ChatOllama(
                model=settings.LLM_MODEL,
                base_url=settings.OLLAMA_BASE_URL,
                temperature=0.2,
                format="json"
            )
            logger.info(f"[FixerAgent] Using Ollama model: {settings.LLM_MODEL}")
        elif self.provider == "mistral":
            self.llm = ChatMistralAI(
                model=settings.MISTRAL_MODEL,
                api_key=settings.MISTRAL_API_KEY,
                temperature=0.2
            )
            logger.info(f"[FixerAgent] Using Mistral model: {settings.MISTRAL_MODEL}")
        else:
            raise ValueError(f"Unsupported LLM_PROVIDER '{self.provider}'. Use gemini, ollama, or mistral.")

    def _invoke_with_ollama_fallback(self, system_prompt: str, user_prompt: str, reason: str) -> str | None:
        if not self.ollama_fallback_llm:
            return None

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        try:
            response = self.ollama_fallback_llm.invoke(messages)
            self.last_provider_used = "ollama"
            logger.warning(
                f"[FixerAgent] Switched to Ollama fallback due to Gemini issue: {reason}"
            )
            return response.content if hasattr(response, "content") else str(response)
        except Exception as fallback_error:
            logger.warning(
                f"[FixerAgent] Ollama fallback also failed: {fallback_error}"
            )
            return None

    def _invoke_with_prompts(self, system_prompt: str, user_prompt: str) -> str:
        self.last_provider_used = self.provider
        if self.provider == "gemini":
            combined_prompt = (
                f"{system_prompt}\n\n"
                f"{user_prompt}\n\n"
                "Return ONLY valid JSON."
            )
            last_error = None
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    response = self.gemini_client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=combined_prompt,
                    )
                    text = getattr(response, "text", None)
                    self.last_provider_used = "gemini"
                    return text if text else str(response)
                except Exception as e:
                    last_error = e
                    error_text = str(e).upper()
                    is_quota_limited = (
                        "429" in error_text
                        or "RESOURCE_EXHAUSTED" in error_text
                        or "QUOTA" in error_text
                    )
                    if is_quota_limited:
                        fallback_response = self._invoke_with_ollama_fallback(
                            system_prompt,
                            user_prompt,
                            str(e),
                        )
                        if fallback_response:
                            return fallback_response

                    is_retryable = (
                        "503" in error_text
                        or "UNAVAILABLE" in error_text
                        or "429" in error_text
                        or "RESOURCE_EXHAUSTED" in error_text
                        or "TIMEOUT" in error_text
                    )
                    if not is_retryable or attempt == max_attempts:
                        raise

                    backoff_seconds = 0.7 * (2 ** (attempt - 1))
                    logger.warning(
                        f"[FixerAgent] Gemini transient error on attempt {attempt}/{max_attempts}: {e}. Retrying in {backoff_seconds:.1f}s"
                    )
                    time.sleep(backoff_seconds)

            if last_error:
                raise last_error

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        response = self.llm.invoke(messages)
        self.last_provider_used = self.provider
        return response.content if hasattr(response, "content") else str(response)

    async def generate_fix(self, diagnosis: dict, repo: str, branch: str,
                           raw_logs: str) -> dict:
        """Generate a fix plan from diagnosis output."""
        logger.info(f"[FixerAgent] Generating fix for category: {diagnosis.get('failure_category')}")

        # Check if there's a known fix from vector store
        similar_fixes = await self.vector_store.search_known_fixes(
            diagnosis.get("failure_category", "unknown"),
            diagnosis.get("root_cause", ""),
            top_k=2
        )

        similar_context = ""
        if similar_fixes:
            fixes_text = "\n".join([
                f"Fix #{i+1}: {f.get('fix_description')} → Script: {f.get('fix_script', '')[:200]}"
                for i, f in enumerate(similar_fixes)
            ])
            similar_context = f"\n=== KNOWN FIXES FOR SIMILAR FAILURES ===\n{fixes_text}"

        user_prompt = f"""
Repository: {repo}
Branch: {branch}

=== DIAGNOSIS ===
Root Cause: {diagnosis.get('root_cause')}
Category: {diagnosis.get('failure_category')}
Affected Files: {', '.join(diagnosis.get('affected_files', []))}
Error Lines: {chr(10).join(diagnosis.get('error_lines', [])[:5])}

=== RELEVANT LOG SNIPPET ===
{raw_logs[-1500:]}
{similar_context}

Generate a safe, executable fix script for this CI/CD pipeline failure.
"""
        try:
            response_text = self._invoke_with_prompts(
                FIXER_SYSTEM_PROMPT,
                user_prompt,
            )
            result = self._parse_json_response(response_text)
            if self.provider == "gemini" and self.last_provider_used == "ollama":
                result["fix_description"] = (
                    f"Gemini quota/rate limit hit; generated via local Ollama fallback: {result.get('fix_description', '')}".strip()
                )
        except Exception as e:
            logger.error(f"FixerAgent LLM failed: {e}")
            result = self._fallback_fix(diagnosis)
            if self.provider == "gemini":
                result["fix_description"] = (
                    f"Gemini was temporarily unavailable; using fallback fix strategy for {diagnosis.get('failure_category', 'unknown')}"
                )

        logger.info(f"[FixerAgent] Fix type: {result.get('fix_type')}, Risk: {result.get('estimated_risk')}")
        return result

    def _parse_json_response(self, content: str) -> dict:
        if not isinstance(content, str):
            content = str(content)

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError("Could not parse fix JSON")

    def _fallback_fix(self, diagnosis: dict) -> dict:
        """Rule-based fallback fixes for common categories."""
        cat = diagnosis.get("failure_category", "unknown")

        scripts = {
            "dependency_error": "#!/bin/bash\nset -e\necho 'Installing dependencies...'\npip install -r requirements.txt\necho 'Done.'",
            "test_failure": "#!/bin/bash\nset -e\necho 'Running tests in verbose mode to identify failures...'\npytest --tb=short -v || true",
            "build_error": "#!/bin/bash\nset -e\necho 'Cleaning build artifacts...'\nfind . -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true\nfind . -name '*.pyc' -delete 2>/dev/null || true\nnpm run build 2>/dev/null || pip install -e . 2>/dev/null || echo 'Build cleanup done'",
            "permissions_error": "#!/bin/bash\nset -e\necho 'Fixing permissions...'\nchmod +x scripts/*.sh 2>/dev/null || true\nchown -R $(whoami) . 2>/dev/null || true",
            "network_error": "#!/bin/bash\nset -e\necho 'Checking network and retrying...'\nfor i in 1 2 3; do\n  wget -q --spider https://pypi.org && break\n  echo \"Retry $i...\"\n  sleep 10\ndone\npip install --retries 5 -r requirements.txt",
        }

        script = scripts.get(cat, "#!/bin/bash\necho 'Manual intervention required'\nexit 1")
        return {
            "fix_type": cat.replace("_error", "") if cat != "unknown" else "manual",
            "fix_description": f"Automated fallback fix for {cat}",
            "fix_script": script,
            "pre_conditions": [],
            "post_conditions": [],
            "estimated_risk": 0.4,
            "requires_restart": False,
            "rollback_script": "#!/bin/bash\necho 'No rollback needed for this fix'"
        }
