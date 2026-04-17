from __future__ import annotations

import os
from typing import Any

import httpx


class LLMError(RuntimeError):
    pass


def _env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default
    return v


def _default_provider() -> str:
    # Prefer explicit provider selection, otherwise choose a sensible free default.
    provider = _env("LLM_PROVIDER")
    if provider:
        return provider.lower()
    if _env("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "ollama"


def chat_text(*, prompt: str, max_tokens: int, model: str | None = None) -> str:
    """Return a single assistant message as plain text."""
    provider = _default_provider()
    if provider == "anthropic":
        return _anthropic_chat(prompt=prompt, max_tokens=max_tokens, model=model)
    if provider in {"ollama", "local"}:
        return _ollama_chat(prompt=prompt, max_tokens=max_tokens, model=model)
    if provider in {"openai", "openai_compatible", "openai-compatible"}:
        return _openai_compatible_chat(prompt=prompt, max_tokens=max_tokens, model=model)
    raise LLMError(
        f"Unsupported LLM_PROVIDER={provider!r}. "
        "Use one of: anthropic | ollama | openai_compatible"
    )


def _anthropic_chat(*, prompt: str, max_tokens: int, model: str | None) -> str:
    api_key = _env("ANTHROPIC_API_KEY")
    if not api_key:
        raise LLMError("ANTHROPIC_API_KEY is not set, but LLM_PROVIDER=anthropic.")

    try:
        import anthropic  # type: ignore
    except Exception as e:  # pragma: no cover
        raise LLMError(
            "Anthropic SDK is not installed. Install `anthropic` or choose another provider."
        ) from e

    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model or _env("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    # anthropic SDK returns a content list; most responses are a single text block.
    return resp.content[0].text.strip()


def _ollama_chat(*, prompt: str, max_tokens: int, model: str | None) -> str:
    base_url = _env("OLLAMA_BASE_URL", "http://localhost:11434")
    chosen_model = model or _env("OLLAMA_MODEL", "llama3.1")

    payload: dict[str, Any] = {
        "model": chosen_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"num_predict": max_tokens},
    }

    try:
        with httpx.Client(timeout=120) as client:
            r = client.post(f"{base_url}/api/chat", json=payload)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise LLMError(
            "Failed to call Ollama. Ensure it is running locally and the model is pulled. "
            "Example: `ollama serve` and `ollama pull llama3.1`."
        ) from e

    msg = (data.get("message") or {}).get("content")
    if not isinstance(msg, str) or not msg.strip():
        raise LLMError(f"Ollama returned unexpected response: {data!r}")
    return msg.strip()


def _openai_compatible_chat(*, prompt: str, max_tokens: int, model: str | None) -> str:
    api_key = _env("OPENAI_API_KEY")
    base_url = _env("OPENAI_API_BASE", "https://api.openai.com")
    chosen_model = model or _env("OPENAI_MODEL", "gpt-4.1-mini")

    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set, but LLM_PROVIDER=openai_compatible.")

    # OpenRouter requires these headers to identify the app
    headers: dict[str, str] = {"Authorization": f"Bearer {api_key}"}
    if "openrouter.ai" in (base_url or ""):
        headers["HTTP-Referer"] = "https://github.com/vectorplusplus"
        headers["X-Title"] = "Vector++"

    payload: dict[str, Any] = {
        "model": chosen_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }

    try:
        with httpx.Client(timeout=180) as client:  # 3 min — free tier can be slow
            r = client.post(
                f"{base_url.rstrip('/')}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        raise LLMError(
            f"OpenRouter API error {e.response.status_code}: {e.response.text[:300]}"
        ) from e
    except Exception as e:
        raise LLMError("Failed to call OpenAI-compatible /v1/chat/completions.") from e

    try:
        content = data["choices"][0]["message"]["content"]
    except Exception as e:
        raise LLMError(f"OpenAI-compatible response shape unexpected: {data!r}") from e

    if not isinstance(content, str):
        raise LLMError(f"OpenAI-compatible content not a string: {data!r}")
    return content.strip()

