# Phase 2: LLM Fallback Diagnosis & Token Governance

## Purpose

Phase 2 adds an intelligent fallback path when rule-based diagnosis confidence is low. It calls a large language model (LLM) to perform reasoning-based diagnosis while enforcing strict token budget limits and providing graceful degradation on any failure.

**Key characteristics**:

- **Conditional execution**: Only called when rule confidence < 75%
- **Budget-gated**: Max 2 calls per incident, max $0.15 estimated cost per incident
- **Graceful degradation**: Timeouts, parse errors, connection failures don't crash—silently fall back to rule-only
- **Robust JSON parsing**: 3-tier fallback strategy to extract diagnosis from LLM response

---

## Component Position

````
Rule-Based Diagnosis Result (confidence, features, root_cause)
        ↓
    Is confidence >= 75%?
        ├─ YES → Send to Planner (skip LLM)
        └─ NO ↓
    ┌─────────────────────────────────────────────────┐
    │    LLM Fallback Diagnosis Module                 │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Token Governor: Can we afford AI call?      │ │
    │ │ (< 2 calls, < $0.15 estimated)             │ │
    │ └─────────────────────────────────────────────┘ │
    │         ↓                                        │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ LLM API Call (prompt-based reasoning)       │ │
    │ │ Timeout: 30s, with graceful degradation    │ │
    │ └─────────────────────────────────────────────┘ │
    │         ↓                                        │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ JSON Extraction (3-tier fallback)          │ │
    │ │ Tier 1: Fenced block ```json...```        │ │
    │ │ Tier 2: Greedy regex {..."...}           │ │
    │ │ Tier 3: Incremental JSON decoder          │ │
    │ └─────────────────────────────────────────────┘ │
    │         ↓                                        │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Normalize & Validate Diagnosis             │ │
    │ │ {root_cause, confidence, reasoning,        │ │
    │ │  suggested_actions, source}                │ │
    │ └─────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────┘
        ↓ (success or graceful fallback to rule-only)
    DiagnosisPayload → Planner
````

---

## File Reference

**LLM Fallback**: `backend/diagnosis/llm_fallback.py` (~280 lines)  
**Token Governance**: `backend/governance/token_governor.py` (~130 lines)  
**Tests**: `backend/tests/test_llm_fallback.py` (12 tests)

---

## Token Governor: Budget Enforcement

### Budget Configuration

```python
@dataclass
class TokenBudget:
    max_calls_per_incident: int = 2
    max_estimated_cost_usd: float = 0.15
    rule_confidence_threshold: float = 0.75
```

| Parameter                   | Value | Purpose                                       |
| --------------------------- | ----- | --------------------------------------------- |
| `max_calls_per_incident`    | 2     | Prevent runaway AI usage (only retry once)    |
| `max_estimated_cost_usd`    | 0.15  | Hard cap on incident diagnostic cost          |
| `rule_confidence_threshold` | 0.75  | Trigger LLM fallback if rule confidence < 75% |

### Cost Tracking (Dual-Track)

```python
class TokenGovernor:
    # Estimated tracking (for budget gating)
    estimated_tokens_this_incident = 0
    estimated_cost_this_incident = 0.0

    # Actual tracking (for billing/audit)
    actual_tokens_this_incident = 0
    cost_this_incident = 0.0
```

**Why two tracks?**

- **Estimated**: Used to decide "can we afford this call?" (forward-looking gate)
- **Actual**: Used to record "what did we actually spend?" (backward-looking audit)

This prevents the scenario where we estimate $0.10, but actual comes in at $0.20 and exceeds budget retroactively.

### Cost Estimation

```python
def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost based on token count and model pricing.

    Returns unrounded cost to preserve precision for budget enforcement.
    Callers should round only when presenting/logging to users.
    """
    pricing = self.MODEL_PRICING.get(
        self.model,
        self.MODEL_PRICING["gpt-3.5-turbo"]
    )
    input_cost = input_tokens * pricing["input"]
    output_cost = output_tokens * pricing["output"]
    return input_cost + output_cost  # Unrounded for precision
```

### Model Pricing

```python
MODEL_PRICING = {
    "gpt-4": {"input": 30.0 / 1_000_000, "output": 60.0 / 1_000_000},
    "gpt-3.5-turbo": {"input": 0.5 / 1_000_000, "output": 1.5 / 1_000_000},
    "claude": {"input": 8.0 / 1_000_000, "output": 24.0 / 1_000_000},
}
```

**Format**: Per-token cost (prices are per 1M tokens ÷ 1,000,000 = per-token rate).

### Budget Decision Gate

```python
def can_afford_ai_call(self, estimated_cost: float) -> bool:
    """Check if AI call is within budget."""
    # Check both call count and cost
    if self.calls_this_incident >= self.budget.max_calls_per_incident:
        return False
    if (self.estimated_cost_this_incident + estimated_cost) > self.budget.max_estimated_cost_usd:
        return False
    return True
```

**Decision logic**: Allowed only if BOTH call count < 2 AND estimated cost < $0.15.

---

## LLM Fallback Diagnosis

### Prompt Engineering

The prompt guides the LLM to analyze the incident and respond with structured JSON:

```python
def _construct_diagnosis_prompt(snapshot: Dict[str, Any]) -> str:
    """Construct diagnosis prompt from incident snapshot."""
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
{chr(10).join(f"- {sig}" for sig in logs_summary[:5]) if logs_summary else "- None"}

**Task:** Identify the most likely root cause. Respond with JSON:
{{
    "root_cause": "brief root cause description",
    "confidence": 0.0-1.0,
    "reasoning": "explanation",
    "suggested_actions": ["action1", "action2"]
}}

Respond with ONLY valid JSON, no extra text."""
    return prompt
```

### API Call with Timeout & Error Handling

```python
def call_llm_api(
    incident_snapshot: Dict[str, Any],
    model: str = "custom-api",
    api_url: Optional[str] = None,
    timeout_seconds: int = 30,
) -> Optional[Dict[str, Any]]:
    """Call LLM API with graceful error handling."""

    # Resolve endpoint
    resolved_api_url = api_url or os.getenv("LLM_FALLBACK_API_URL")
    if not resolved_api_url:
        logger.warning(f"LLM endpoint not configured; skipping AI call")
        return None

    try:
        response = requests.post(
            resolved_api_url,
            json={"message": prompt, "model": model},
            timeout=timeout_seconds,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        response_data = response.json()
        diagnosis = _parse_llm_response(response_data, incident_snapshot)
        return diagnosis

    except requests.exceptions.Timeout:
        logger.warning(f"LLM timeout after {timeout_seconds}s; falling back to rule-only")
        return None
    except requests.exceptions.ConnectionError as e:
        logger.warning(f"LLM connection failed; falling back to rule-only: {e}")
        return None
    except requests.exceptions.HTTPError as e:
        logger.warning(f"LLM HTTP error; falling back to rule-only: {e}")
        return None
    except (ValueError, KeyError, json.JSONDecodeError) as e:
        logger.warning(f"Failed to parse LLM response; falling back to rule-only: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected LLM error: {e}")
        raise LLMFallbackError(f"LLM fallback failed unexpectedly: {e}") from e
```

**Error handling strategy**:

- **Timeout (30s)**: Assume API is slow or unreachable; fall back
- **Connection error**: Network issue; fall back
- **HTTP error (4xx/5xx)**: API failure; fall back
- **JSON parse error**: Malformed response; fall back
- **Unexpected error**: Crash with clear exception (preserve stack trace for debugging)

---

## JSON Parsing: 3-Tier Fallback Strategy

The LLM may return:

1. Clean fenced JSON: ``json {...}`
2. Partially malformed JSON with non-JSON wrapper text
3. Greedy text that happens to contain valid JSON

We try three strategies in order:

### Tier 1: Fenced Block Extraction

````python
def _parse_llm_message_json(message: str) -> Dict[str, Any]:
    """Extract JSON from LLM response with 3-tier fallback strategy."""

    # Tier 1: Look for ```json ... ``` fence
    fenced_match = re.search(
        r'```json\s*(.*?)\s*```',
        message,
        re.DOTALL
    )
    if fenced_match:
        json_text = fenced_match.group(1)
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            pass  # Fall through to Tier 2
````

**Success case**:

````
Model response:
"Here's the diagnosis:

```json
{
    "root_cause": "memory exhaustion",
    "confidence": 0.95,
    "reasoning": "OOMKilled event + 95% memory",
    "suggested_actions": ["increase memory limit"]
}
````

Extraction: Success (found fenced block)"

````

### Tier 2: Greedy Regex Extraction

```python
    # Tier 2: Look for {...} pattern (greedy)
    greedy_match = re.search(r'\{.*\}', message, re.DOTALL)
    if greedy_match:
        json_text = greedy_match.group(0)
        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            pass  # Fall through to Tier 3
````

**Success case**:

```
Model response:
"The diagnosis is: {
    "root_cause": "memory exhaustion",
    "confidence": 0.95,
    ...
} That's my assessment."

Extraction: Success (greedy regex found {...})"
```

### Tier 3: Incremental JSON Decoder

```python
    # Tier 3: Try incremental decoder (handles incomplete JSON)
    decoder = json.JSONDecoder()
    idx = 0
    while idx < len(message):
        try:
            obj, end_idx = decoder.raw_decode(message, idx)
            return obj  # Success!
        except json.JSONDecodeError as e:
            idx = e.pos + 1
            if idx >= len(message):
                break

    # All tiers failed
    raise ValueError(f"Could not extract JSON from: {message[:100]}...")
```

**Success case**:

```
Model response:
"garbage text { "root_cause": "...", ... } more garbage"

Extraction: Success (incremental decoder found valid object)"
```

---

## Response Normalization

```python
def _parse_llm_response(response_data: Dict[str, Any], snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Parse LLM response and normalize to standard format."""

    message = response_data.get("message", "")
    if not message:
        raise ValueError("No message in LLM response")

    # Extract JSON using 3-tier strategy
    diagnosis = _parse_llm_message_json(message)

    # Validate required fields
    for field in ["root_cause", "confidence"]:
        if field not in diagnosis:
            raise ValueError(f"Missing required field: {field}")

    # Coerce confidence to float, clamp to [0, 1]
    raw_confidence = diagnosis.get("confidence", 0)
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        logger.warning(f"Invalid confidence {raw_confidence!r}, defaulting to 0.0")
        confidence = 0.0

    if not (0 <= confidence <= 1):
        logger.warning(f"Clamping confidence {raw_confidence!r} to [0, 1]")
        confidence = max(0.0, min(1.0, confidence))

    # Normalize response to standard format
    return {
        "root_cause": str(diagnosis["root_cause"]),
        "confidence": float(confidence),
        "reasoning": str(diagnosis.get("reasoning", "AI diagnosed based on incident signals")),
        "suggested_actions": diagnosis.get("suggested_actions", []),
        "source": "llm_fallback",
    }
```

---

## Integration: Should We Use LLM Fallback?

```python
def should_use_llm_fallback(
    rule_confidence: float,
    rule_result: Optional[DiagnosisResult],
    token_governor: TokenGovernor,
) -> bool:
    """Decide whether to call LLM fallback."""

    # Decision 1: Rule confidence sufficient?
    if rule_confidence >= token_governor.budget.rule_confidence_threshold:
        return False  # High confidence rule result; skip AI

    # Decision 2: Can we afford AI call?
    estimated_input = token_governor.estimate_tokens("incident snapshot")
    estimated_output = token_governor.estimate_tokens("diagnosis summary")
    estimated_cost = token_governor.estimate_cost(estimated_input, estimated_output)

    if not token_governor.can_afford_ai_call(estimated_cost):
        return False  # Budget exceeded; skip AI

    return True  # Low confidence + budget available → use AI
```

**Decision tree**:

1. If rule confidence >= 75%: Use rule result (skip AI)
2. If rule confidence < 75% AND budget allows: Call AI
3. If rule confidence < 75% AND budget exceeded: Fall back to rule result anyway

---

## Test Coverage (12 Tests)

**File**: `backend/tests/test_llm_fallback.py`

| Test                                  | What It Validates                                     |
| ------------------------------------- | ----------------------------------------------------- |
| `test_llm_api_success`                | Full successful API call + JSON parsing               |
| `test_llm_response_timeout`           | Timeout gracefully falls back to None                 |
| `test_llm_response_connection_error`  | Connection error gracefully falls back                |
| `test_llm_response_http_error`        | HTTP 5xx gracefully falls back                        |
| `test_json_parse_fenced_block`        | Tier 1: Fenced `json ... ` extraction                 |
| `test_json_parse_greedy_regex`        | Tier 2: Greedy {...} extraction                       |
| `test_json_parse_incremental_decoder` | Tier 3: Incremental decoder fallback                  |
| `test_json_parse_all_tiers_fail`      | Raises ValueError if all tiers fail                   |
| `test_confidence_coercion`            | Confidence converted to float + clamped to [0, 1]     |
| `test_missing_required_fields`        | Raises ValueError if root_cause or confidence missing |
| `test_token_governor_budget_gate`     | Budget check: call count + cost gates                 |
| `test_token_governor_cost_tracking`   | Dual-track: estimated vs actual cost                  |

---

## Running the Tests

```bash
cd hacktofuture4-A07

# Run LLM fallback tests
pytest backend/tests/test_llm_fallback.py -v

# Example output
# test_llm_api_success PASSED
# test_llm_response_timeout PASSED
# test_llm_response_connection_error PASSED
# test_llm_response_http_error PASSED
# test_json_parse_fenced_block PASSED
# test_json_parse_greedy_regex PASSED
# test_json_parse_incremental_decoder PASSED
# test_json_parse_all_tiers_fail PASSED
# test_confidence_coercion PASSED
# test_missing_required_fields PASSED
# test_token_governor_budget_gate PASSED
# test_token_governor_cost_tracking PASSED
# ===== 12 passed in 0.15s =====
```

---

## Configuration

### Environment Variables

```bash
# .env or system environment
LLM_FALLBACK_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-3.5-turbo
```

### Timeout Configuration

Default: 30 seconds. Override in code:

```python
diagnosis = call_llm_api(
    incident_snapshot,
    model="gpt-3.5-turbo",
    timeout_seconds=20,  # Custom timeout
)
```

---

## Key Design Decisions

### 1. Graceful Degradation

Any failure (timeout, parse, connection) silently falls back without crashing. This ensures rule-only diagnosis is always available as a safety net.

### 2. Dual-Track Cost Accounting

Estimated vs. actual costs are tracked separately. This prevents the scenario where actual spending exceeds budget after the fact.

### 3. 3-Tier JSON Parsing

LLMs are imperfect at JSON formatting. The 3-tier strategy maximizes extraction success:

- Tier 1 (fenced): Most structured LLM responses use backtick fences
- Tier 2 (greedy): Fallback for partially malformed JSON
- Tier 3 (incremental): Last resort for "JSON-like" text

### 4. Unrounded Cost for Budget Precision

`estimate_cost()` returns full-precision float (e.g., 0.000015234). Rounding only happens on display/logging to prevent small costs rounding to 0.0 and breaking budget enforcement.

### 5. Confidence Coercion & Clamping

LLMs may return confidence as string, out-of-range value, or non-numeric. We defensively coerce to float and clamp to [0, 1].

---

## Example Walkthrough: Unconfident Rule + AI Fallback

**Rule result**: FP-004 (FailedScheduling) with confidence 0.60 (low)

**Decision**: 0.60 < 0.75 → Check budget → Budget available → Call LLM

**Prompt**:

```
Analyze this Kubernetes incident and provide diagnosis:

**Current Metrics:**
- Memory: 85%
- CPU: 70%
- Restart Count: 2

**Events:**
- FailedScheduling: insufficient CPU

**Log Signatures (top 5):**
- "Insufficient CPU for pod placement"

**Task:** Identify the most likely root cause. Respond with JSON:
{...}
```

**LLM Response** (with wrapper text):

````
Based on the metrics, this looks like a cluster resource saturation issue. Here's my analysis:

```json
{
    "root_cause": "cluster CPU pool exhausted; unable to schedule new pods on available nodes",
    "confidence": 0.88,
    "reasoning": "FailedScheduling event + CPU at 70% indicates resource pressure at cluster level",
    "suggested_actions": [
        "add more compute nodes to cluster",
        "migrate non-critical pods to other cluster",
        "reduce pod resource requests"
    ]
}
````

That's my final diagnosis.

````

**Parsing**: Tier 1 (fenced block) succeeds → Extract JSON

**Normalization**:
```json
{
    "root_cause": "cluster CPU pool exhausted; unable to schedule new pods on available nodes",
    "confidence": 0.88,
    "reasoning": "FailedScheduling event + CPU at 70% indicates resource pressure at cluster level",
    "suggested_actions": [
        "add more compute nodes to cluster",
        "migrate non-critical pods to other cluster",
        "reduce pod resource requests"
    ],
    "source": "llm_fallback"
}
````

**Cost Tracking**:

- Estimated: 200 input tokens × $0.5/M + 100 output tokens × $1.5/M = $0.00015
- Actual: 198 input tokens + 102 output tokens = $0.000148
- Total incident cost: $0.000148 (well under $0.15 budget)

**Result**: LLM diagnosis (0.88 confidence) is higher than rule diagnosis (0.60), so use AI result.

---

## Next: Phase 2 Planner (Policy Ranking)

With a confidence diagnosis from either rule or AI fallback, Phase 2 also includes policy-based action ranking. See [03-phase2-planner.md](03-phase2-planner.md).
