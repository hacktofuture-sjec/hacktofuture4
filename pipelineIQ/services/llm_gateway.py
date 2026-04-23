from __future__ import annotations

from openai import AsyncOpenAI

from config import settings


class LLMCallError(RuntimeError):
    pass


def _client_for_provider(provider: str) -> tuple[AsyncOpenAI, str]:
    normalized = provider.lower()

    if normalized == "openai":
        if not settings.OPENAI_API_KEY:
            raise LLMCallError("Missing OPENAI_API_KEY")
        return (
            AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE_URL,
            ),
            normalized,
        )

    if normalized == "groq":
        if not settings.GROQ_API_KEY:
            raise LLMCallError("Missing GROQ_API_KEY")
        return (
            AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url=settings.GROQ_API_BASE_URL,
            ),
            normalized,
        )

    if normalized == "github_models":
        if not settings.GITHUB_TOKEN:
            raise LLMCallError("Missing GITHUB_TOKEN")
        return (
            AsyncOpenAI(
                api_key=settings.GITHUB_TOKEN,
                base_url=settings.GITHUB_MODELS_API_BASE_URL,
            ),
            normalized,
        )

    raise LLMCallError(f"Unsupported provider: {provider}")


async def call_chat_model(
    *,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1000,
) -> str:
    client, normalized_provider = _client_for_provider(provider)

    response = await client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        top_p=1.0,
        max_tokens=max_tokens,
        model=model,
    )

    try:
        return response.choices[0].message.content.strip()
    except (AttributeError, IndexError) as exc:
        raise LLMCallError(
            f"Malformed LLM response from {normalized_provider}:{model}"
        ) from exc


async def call_with_fallback(
    *,
    primary_provider: str,
    primary_model: str,
    fallback_provider: str,
    fallback_model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1000,
) -> tuple[str, str, str]:
    try:
        result = await call_chat_model(
            provider=primary_provider,
            model=primary_model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return result, primary_provider, primary_model
    except Exception:
        result = await call_chat_model(
            provider=fallback_provider,
            model=fallback_model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return result, fallback_provider, fallback_model
