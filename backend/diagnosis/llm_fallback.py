"""
LLM-based fallback diagnosis when rule-based fingerprinting confidence is low.
Handles AI API calls with JSON parsing, graceful error handling, and token budgeting.
"""

import json
import logging
import os
import re
from urllib.parse import urlparse
from typing import Optional, Dict, Any
import requests
from models.schemas import DiagnosisPayload, IncidentSnapshot, StructuredReasoning

logger = logging.getLogger(__name__)


def _safe_endpoint_label(url: str) -> str:
    """Return a non-sensitive endpoint label for logs."""
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}"
    except Exception:
        pass
    return "<invalid-url>"


class LLMFallbackError(Exception):
    """Exception for LLM fallback processing errors."""
    pass


def call_llm_api(
    incident_snapshot: Dict[str, Any],
    model: str = "custom-api",
    api_url: Optional[str] = None,
    timeout_seconds: int = 30,
) -> Optional[Dict[str, Any]]:
    """
    Call LLM API to diagnose incident when rule-based confidence is low.
    
    Args:
        incident_snapshot: IncidentSnapshot dict with metrics, events, logs
        model: Model identifier (for tracking/logging)
        api_url: LLM API endpoint
        timeout_seconds: Request timeout
    
    Returns:
        Parsed diagnosis dict with fields: {root_cause, confidence, reasoning, suggested_actions, source}
        Returns None if API fails or parsing fails (graceful degradation)
    
    Raises:
        LLMFallbackError: If API communication fails unexpectedly
    """
    
    # Resolve endpoint from caller input or environment configuration.
    resolved_api_url = api_url or os.getenv("LLM_FALLBACK_API_URL")
    if not resolved_api_url:
        logger.warning(
            f"LLM fallback endpoint is not configured for model '{model}'; skipping AI call"
        )
        return None

    # Construct prompt for LLM
    prompt = _construct_diagnosis_prompt(incident_snapshot)
    resolved_model = os.getenv("LLM_FALLBACK_MODEL") or os.getenv("GROQ_MODEL") or model
    api_key = os.getenv("LLM_FALLBACK_API_KEY") or os.getenv("GROQ_API_KEY")

    logger.info(
        "LLM fallback request: endpoint=%s model=%s auth_header=%s",
        _safe_endpoint_label(resolved_api_url),
        resolved_model,
        "present" if api_key else "absent",
    )
    
    try:
        # Call LLM API
        payload = _build_llm_payload(prompt, resolved_model)
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        response = requests.post(
            resolved_api_url,
            json=payload,
            timeout=timeout_seconds,
            headers=headers,
        )
        response.raise_for_status()
        
        # Parse response
        response_data = response.json()
        
        # Extract diagnosis from LLM response
        diagnosis = _parse_llm_response(response_data, incident_snapshot)
        
        logger.info(
            f"LLM fallback diagnosis using model '{model}': "
            f"{diagnosis['root_cause']} (confidence: {diagnosis['confidence']})"
        )
        return diagnosis
        
    except requests.exceptions.Timeout:
        logger.warning(
            f"LLM API timeout after {timeout_seconds}s for model '{model}' - "
            "falling back to rule-only"
        )
        return None
    except requests.exceptions.ConnectionError as e:
        logger.warning(
            f"LLM API connection failed for model '{model}' - falling back to "
            f"rule-only: {e}"
        )
        return None
    except requests.exceptions.HTTPError as e:
        logger.warning(
            f"LLM API HTTP error for model '{model}' - falling back to rule-only: {e}"
        )
        return None
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        logger.warning(
            f"Failed to parse LLM response for model '{model}' - "
            f"falling back to rule-only: {e}"
        )
        return None
    except Exception as e:
        logger.error(f"Unexpected LLM fallback error for model '{model}': {e}")
        raise LLMFallbackError(f"LLM fallback failed unexpectedly: {e}") from e


def _construct_diagnosis_prompt(snapshot: Dict[str, Any]) -> str:
    """
    Construct a diagnosis prompt for the LLM based on incident snapshot.
    
    Args:
        snapshot: IncidentSnapshot with metrics, events, logs
    
    Returns:
        Formatted prompt for LLM API
    """
    
    metrics = snapshot.get("metrics", {})
    events = snapshot.get("events", [])
    logs_summary = snapshot.get("logs_summary", [])
    
    prompt = f"""Analyze this Kubernetes incident and provide diagnosis:

**Current Metrics:**
- Memory: {metrics.get('memory_pct', 'unknown')}%
- CPU: {metrics.get('cpu_pct', 'unknown')}%
- Restart Count: {metrics.get('restart_count', 'unknown')}

**Events:**
{chr(10).join(f"- {e}" for e in events[:5]) if events else "- None"}

**Log Signatures (top 5):**
{chr(10).join(f"- {log_signature}" for log_signature in logs_summary[:5]) if logs_summary else "- None"}

**Task:** Identify the most likely root cause. Respond with JSON:
{{
    "root_cause": "brief root cause description",
    "confidence": 0.0-1.0,
    "reasoning": "explanation",
    "suggested_actions": ["action1", "action2"]
}}

Respond with ONLY valid JSON, no extra text."""
    
    return prompt


def _parse_llm_response(response_data: Dict[str, Any], snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse LLM API response and extract diagnosis.
    
    Args:
        response_data: Raw response from LLM API
        snapshot: Original incident snapshot (fallback data source)
    
    Returns:
        Normalized diagnosis dict: {root_cause, confidence, reasoning, suggested_actions, source}
    
    Raises:
        ValueError: If response format is invalid
    """
    
    # Extract message text from a variety of API response shapes.
    message = _extract_message_text(response_data)
    if not message:
        raise ValueError("No message in LLM response")
    
    try:
        diagnosis = _parse_llm_message_json(message)
    except ValueError as e:
        raise ValueError(f"Failed to parse JSON from LLM response: {e}") from e
    
    # Validate required fields
    required_fields = ["root_cause", "confidence"]
    for field in required_fields:
        if field not in diagnosis:
            raise ValueError(f"Missing required field: {field}")
    
    # Ensure confidence is numeric and clamped to [0, 1].
    raw_confidence = diagnosis.get("confidence", 0)
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        logger.warning(f"Invalid confidence value: {raw_confidence!r}, defaulting to 0.0")
        confidence = 0.0

    if not (0 <= confidence <= 1):
        logger.warning(f"Out-of-range confidence value: {raw_confidence!r}, clamping to valid range")
        confidence = max(0.0, min(1.0, confidence))
    
    # Normalize response
    return {
        "root_cause": str(diagnosis["root_cause"]),
        "confidence": float(confidence),
        "reasoning": str(diagnosis.get("reasoning", "AI diagnosed based on incident signals")),
        "suggested_actions": _normalize_suggested_actions(diagnosis),
        "source": "llm_fallback",
    }


def _normalize_suggested_actions(diagnosis: Dict[str, Any]) -> list[str]:
    """Extract a clean list of action suggestions from common LLM response keys."""
    candidates = diagnosis.get("suggested_actions")
    if candidates is None:
        candidates = diagnosis.get("actions")
    if candidates is None:
        candidates = diagnosis.get("recommendations")
    if candidates is None:
        candidates = diagnosis.get("next_steps")

    if isinstance(candidates, str):
        text = candidates.strip()
        return [text] if text else []

    if isinstance(candidates, list):
        cleaned: list[str] = []
        for item in candidates:
            value = str(item).strip()
            if value:
                cleaned.append(value)
        return cleaned

    return []


def _build_llm_payload(prompt: str, model: str) -> Dict[str, Any]:
    """Build request payload for chat-compatible and legacy backends."""
    del model
    return {
        "messages": [{"role": "user", "content": prompt}],
    }


def _extract_message_text(response_data: Dict[str, Any]) -> str:
    """Extract text content from common chat/completions response formats."""
    if "message" in response_data and isinstance(response_data["message"], str):
        return response_data["message"]

    choices = response_data.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content
            content = first.get("text")
            if isinstance(content, str):
                return content

    output = response_data.get("output")
    if isinstance(output, str):
        return output

    content = response_data.get("content")
    if isinstance(content, str):
        return content

    return ""


def should_use_llm_fallback(
    rule_confidence: float,
    budget_allows: bool,
    confidence_threshold: float = 0.75,
    token_governor: Optional[Any] = None,
    estimated_ai_cost: Optional[float] = None,
) -> bool:
    """
    Determine if LLM fallback should be used.
    
    Args:
        rule_confidence: Confidence score from rule-based matching (0-1)
        budget_allows: External budget gate (for compatibility)
        confidence_threshold: Threshold under which AI fallback is allowed
        token_governor: Optional TokenGovernor instance for integrated budget checks
        estimated_ai_cost: Optional cost estimate used with token_governor
    
    Returns:
        True if LLM should be called, False otherwise
    """
    if rule_confidence >= confidence_threshold:
        return False

    if not budget_allows:
        return False

    if token_governor is not None:
        if estimated_ai_cost is None:
            default_input = token_governor.estimate_tokens("incident snapshot")
            default_output = token_governor.estimate_tokens("diagnosis summary")
            estimated_ai_cost = token_governor.estimate_cost(default_input, default_output)
        return token_governor.can_afford_ai_call(estimated_ai_cost)

    return True


def _parse_llm_message_json(message: str) -> Dict[str, Any]:
    """
    Parse a JSON object from an LLM message that may contain markdown or extra text.
    """
    try:
        parsed = json.loads(message)
        if not isinstance(parsed, dict):
            raise ValueError("LLM response JSON must be an object")
        return parsed
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    fenced_block_patterns = [
        r"```json\s*(.*?)\s*```",
        r"```\s*(.*?)\s*```",
    ]
    for pattern in fenced_block_patterns:
        for match in re.finditer(pattern, message, re.DOTALL | re.IGNORECASE):
            candidate = match.group(1).strip()
            if not candidate:
                continue
            try:
                parsed = json.loads(candidate)
                if not isinstance(parsed, dict):
                    raise ValueError("LLM response JSON must be an object")
                return parsed
            except (json.JSONDecodeError, TypeError, ValueError):
                continue

    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", message):
        candidate = message[match.start():]
        try:
            parsed, _ = decoder.raw_decode(candidate)
            if not isinstance(parsed, dict):
                continue
            return parsed
        except json.JSONDecodeError:
            continue

    raise ValueError("No valid JSON object found in LLM response")


def rule_only_fallback(snapshot: IncidentSnapshot, features: Dict[str, Any]) -> DiagnosisPayload:
    return DiagnosisPayload(
        root_cause="insufficient high-confidence fingerprint; rule fallback applied",
        confidence=max(0.5, min(0.74, float(snapshot.monitor_confidence))),
        diagnosis_mode="rule",
        fingerprint_matched=False,
        suggested_actions=[],
        estimated_token_cost=0.0,
        actual_token_cost=0.0,
        affected_services=[snapshot.service],
        evidence=[
            f"memory={snapshot.metrics.memory}",
            f"cpu={snapshot.metrics.cpu}",
            f"restarts={snapshot.metrics.restarts}",
        ],
        structured_reasoning=StructuredReasoning(
            matched_rules=[],
            conflicting_signals=[],
            missing_signals=[] if snapshot.trace_summary else ["trace_summary not triggered"],
        ),
    )


def run_ai_diagnosis(
    snapshot: IncidentSnapshot,
    features: Dict[str, Any],
    token_governor,
    db,
    incident_id: str,
) -> DiagnosisPayload:
    del db, incident_id
    force_ai = os.getenv("FORCE_AI_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}
    if token_governor and not force_ai and token_governor.should_fallback_to_rule_only(float(snapshot.monitor_confidence)):
        return rule_only_fallback(snapshot, features)

    raw = call_llm_api(
        {
            "metrics": {
                "memory_pct": snapshot.metrics.memory,
                "cpu_pct": snapshot.metrics.cpu,
                "restart_count": snapshot.metrics.restarts,
            },
            "events": [e.reason for e in snapshot.events],
            "logs_summary": [l.signature for l in snapshot.logs_summary],
        }
    )
    if not raw:
        return rule_only_fallback(snapshot, features)

    return DiagnosisPayload(
        root_cause=raw["root_cause"],
        confidence=float(raw["confidence"]),
        diagnosis_mode="ai",
        fingerprint_matched=False,
        suggested_actions=[str(item).strip() for item in raw.get("suggested_actions", []) if str(item).strip()],
        estimated_token_cost=0.0,
        actual_token_cost=0.0,
        affected_services=[snapshot.service],
        evidence=[str(raw.get("reasoning", ""))],
        structured_reasoning=StructuredReasoning(
            matched_rules=[],
            conflicting_signals=[],
            missing_signals=[] if snapshot.trace_summary else ["trace_summary not triggered"],
        ),
    )
