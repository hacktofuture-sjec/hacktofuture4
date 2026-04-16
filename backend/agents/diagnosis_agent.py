"""
Diagnosis Agent – analyzes pipeline logs and identifies root causes of failures.
"""
import re
import json
import logging
import time
from google import genai

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.chat_models import ChatOllama
from langchain_mistralai import ChatMistralAI

from backend.config import settings
from backend.models.pipeline_event import FailureCategory
from backend.agents.vector_store import VectorStore

logger = logging.getLogger(__name__)


DIAGNOSIS_SYSTEM_PROMPT = """You are PipeGenie's Diagnosis Agent — an expert DevOps AI that analyzes
CI/CD pipeline failure logs to identify root causes.

Your job:
1. Read the pipeline failure logs carefully
2. Identify the exact root cause
3. Classify the failure category
4. Check if this is a recurring pattern

Output ONLY valid JSON with this exact structure:
{
  "root_cause": "clear one-sentence root cause",
  "failure_category": "dependency_error|test_failure|build_error|config_error|network_error|permissions_error|unknown",
  "affected_files": ["file1", "file2"],
  "error_lines": ["exact error line from logs"],
  "confidence": 0.95,
  "summary": "2-3 sentence human-readable summary"
}

Be precise. Focus on the actual error, not symptoms."""


class DiagnosisAgent:
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
            # Keep a local Ollama fallback so quota/rate limits don't force rule-based fallback.
            self.ollama_fallback_llm = ChatOllama(
                model=settings.LLM_MODEL,
                base_url=settings.OLLAMA_BASE_URL,
                temperature=0.1,
                format="json"
            )
            logger.info(f"[DiagnosisAgent] Using Gemini model: {settings.GEMINI_MODEL}")
        elif self.provider == "ollama":
            self.llm = ChatOllama(
                model=settings.LLM_MODEL,
                base_url=settings.OLLAMA_BASE_URL,
                temperature=0.1,
                format="json"
            )
            logger.info(f"[DiagnosisAgent] Using Ollama model: {settings.LLM_MODEL}")
        elif self.provider == "mistral":
            self.llm = ChatMistralAI(
                model=settings.MISTRAL_MODEL,
                api_key=settings.MISTRAL_API_KEY,
                temperature=0.1
            )
            logger.info(f"[DiagnosisAgent] Using Mistral model: {settings.MISTRAL_MODEL}")
        else:
            raise ValueError(f"Unsupported LLM_PROVIDER '{self.provider}'. Use gemini, ollama, or mistral.")

    def get_provider_label(self) -> str:
        active_provider = getattr(self, "last_provider_used", self.provider)
        if active_provider == "gemini":
            return f"gemini:{settings.GEMINI_MODEL}"
        if active_provider == "mistral":
            return f"mistral:{settings.MISTRAL_MODEL}"
        return f"ollama:{settings.LLM_MODEL}"

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
                f"[DiagnosisAgent] Switched to Ollama fallback due to Gemini issue: {reason}"
            )
            return response.content if hasattr(response, "content") else str(response)
        except Exception as fallback_error:
            logger.warning(
                f"[DiagnosisAgent] Ollama fallback also failed: {fallback_error}"
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
                        f"[DiagnosisAgent] Gemini transient error on attempt {attempt}/{max_attempts}: {e}. Retrying in {backoff_seconds:.1f}s"
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

    def invoke_prompt(self, system_prompt: str, user_prompt: str) -> str:
        return self._invoke_with_prompts(system_prompt, user_prompt)

    async def analyze(self, event_id: str, logs: str, repo: str, branch: str,
                      commit_message: str) -> dict:
        """Main diagnosis entry point. Returns structured diagnosis dict."""
        logger.info(f"[DiagnosisAgent] Analyzing event {event_id}")

        # 1. Truncate logs intelligently (keep tail where errors usually are)
        processed_logs = self._smart_truncate(logs)

        # 2. Check vector store for similar past failures
        similar_cases = await self.vector_store.search_similar_failures(
            processed_logs, top_k=3
        )
        similar_context = self._format_similar_cases(similar_cases)

        # 3. Build prompt
        user_prompt = f"""
Repository: {repo}
Branch: {branch}
Commit: {commit_message}

=== PIPELINE FAILURE LOGS ===
{processed_logs}

=== SIMILAR PAST FAILURES (for reference) ===
{similar_context}

Analyze the above logs and return a JSON diagnosis.
"""
        # 4. Call LLM
        try:
            response_text = self._invoke_with_prompts(
                DIAGNOSIS_SYSTEM_PROMPT,
                user_prompt,
            )
            result = self._parse_json_response(response_text)
            if self.provider == "gemini" and self.last_provider_used == "ollama":
                result["summary"] = (
                    f"Gemini quota/rate limit hit; answered via local Ollama fallback: {result.get('summary', '')}".strip()
                )
        except Exception as e:
            logger.error(f"LLM diagnosis failed: {e}")
            result = self._fallback_diagnosis(logs)
            if self.provider == "gemini":
                result["summary"] = (
                    f"Gemini was temporarily unavailable; used rule-based fallback: {result['root_cause']}"
                )

        # 5. Store in vector DB for future recall
        await self.vector_store.store_failure(
            event_id=event_id,
            logs_summary=processed_logs[:500],
            diagnosis=result
        )

        logger.info(f"[DiagnosisAgent] Category: {result.get('failure_category')} | Confidence: {result.get('confidence')}")
        return result

    def _smart_truncate(self, logs: str, max_chars: int = 4000) -> str:
        """Keep the most relevant parts of logs (head + tail)."""
        if len(logs) <= max_chars:
            return logs
        head = logs[:1000]
        tail = logs[-(max_chars - 1000):]
        return f"{head}\n...[truncated]...\n{tail}"

    def _format_similar_cases(self, cases: list) -> str:
        if not cases:
            return "No similar past failures found."
        lines = []
        for i, case in enumerate(cases, 1):
            lines.append(f"Case {i}: {case.get('root_cause', 'N/A')} → Fixed by: {case.get('fix_type', 'N/A')}")
        return "\n".join(lines)

    def _parse_json_response(self, content: str) -> dict:
        """Extract JSON from LLM response even if wrapped in markdown."""
        if not isinstance(content, str):
            content = str(content)

        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        # Try extracting from markdown code block
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Try finding any JSON object
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Could not parse JSON from response: {content[:200]}")

    def _fallback_diagnosis(self, logs: str) -> dict:
        """Rule-based fallback when LLM fails."""
        log_lower = logs.lower()
        if "modulenotfounderror" in log_lower or "no module named" in log_lower:
            category = "dependency_error"
            root_cause = "Missing Python module – dependency not installed"
        elif "assertionerror" in log_lower or "failed test" in log_lower or "pytest" in log_lower:
            category = "test_failure"
            root_cause = "Unit test assertion failed"
        elif "syntaxerror" in log_lower or "unexpected token" in log_lower:
            category = "build_error"
            root_cause = "Syntax error in source code"
        elif "permission denied" in log_lower:
            category = "permissions_error"
            root_cause = "File or resource permission denied"
        elif "connection refused" in log_lower or "timeout" in log_lower:
            category = "network_error"
            root_cause = "Network connection issue"
        else:
            category = "unknown"
            root_cause = "Unknown pipeline failure – manual inspection required"

        return {
            "root_cause": root_cause,
            "failure_category": category,
            "affected_files": [],
            "error_lines": [],
            "confidence": 0.5,
            "summary": f"Automated fallback diagnosis: {root_cause}"
        }
