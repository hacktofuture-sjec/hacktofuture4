# Token Governance: Budget Enforcement & Cost Tracking

## Purpose

The Token Governor enforces hard budget limits on AI calls within the incident response pipeline. It prevents runaway costs by limiting both the count of calls and the total estimated cost per incident.

---

## Budget Model

```python
@dataclass
class TokenBudget:
    max_calls_per_incident: int = 2
    max_estimated_cost_usd: float = 0.15
    rule_confidence_threshold: float = 0.75
```

| Parameter                   | Value | Purpose                                                                        |
| --------------------------- | ----- | ------------------------------------------------------------------------------ |
| `max_calls_per_incident`    | 2     | Max AI diagnostic calls per incident (1 initial + 1 retry)                     |
| `max_estimated_cost_usd`    | 0.15  | Hard cap on diagnostic cost per incident ($0.15 ≈ 300K tokens @ gpt-3.5 rates) |
| `rule_confidence_threshold` | 0.75  | Trigger LLM fallback only if rule confidence < 75%                             |

---

## Dual-Track Cost Accounting

**Why two tracks?**

- **Estimated**: Used to gate decisions ("can we afford this call?")
- **Actual**: Used for audit/billing ("what did we actually spend?")

```python
# Estimated tracking (for budget gating)
estimated_tokens_this_incident = 0  # Input + output tokens
estimated_cost_this_incident = 0.0   # Predicted cost

# Actual tracking (for billing/audit)
actual_tokens_this_incident = 0      # Real consumption
cost_this_incident = 0.0              # Actual cost
```

### Why Not Single-Track?

Scenario: We estimate $0.10, but LLM actually uses $0.20 (unexpected output tokens).

- **Single-track budget**: Would exceed $0.15 cap retroactively (no way to prevent)
- **Dual-track budget**: Estimated gate prevents the call; actual cost safely under budget

---

## Model Pricing Configuration

```python
MODEL_PRICING = {
    "gpt-4": {
        "input": 30.0 / 1_000_000,      # $30 per 1M input tokens
        "output": 60.0 / 1_000_000,     # $60 per 1M output tokens
    },
    "gpt-3.5-turbo": {
        "input": 0.5 / 1_000_000,       # $0.50 per 1M input tokens
        "output": 1.5 / 1_000_000,      # $1.50 per 1M output tokens
    },
    "claude": {
        "input": 8.0 / 1_000_000,       # $8 per 1M input tokens
        "output": 24.0 / 1_000_000,     # $24 per 1M output tokens
    },
}
```

**Calculation**:

```
Rate per 1M tokens ÷ 1,000,000 = rate per single token

Example (gpt-3.5-turbo input):
$0.50 per 1M tokens ÷ 1,000,000 = $0.0000005 per token
```

---

## Cost Estimation Without Rounding

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
    return input_cost + output_cost  # Unrounded
```

**Why no rounding?**

Example: Small token count with rounding to 6 decimals:

```
Input: 200 tokens × $0.0000005/token = $0.0001
Output: 50 tokens × $0.0000015/token = $0.000075
Total: $0.000175

With round(..., 6): round(0.000175, 6) = 0.000175 ✅
But with round(..., 2): round(0.000175, 2) = 0.00 ❌ (ZERO!)

When 0.00 rounds, budget check `cost < 0.15` is always true,
breaking cost gating for small calls.
```

**Solution**: Return full-precision float; only round for display/logging.

---

## Budget Decision Gate

```python
def can_afford_ai_call(self, estimated_cost: float) -> bool:
    """Check if AI call is within budget."""

    # Gate 1: Call count
    if self.calls_this_incident >= self.budget.max_calls_per_incident:
        logger.info(f"AI budget exhausted: {self.calls_this_incident} >= {self.budget.max_calls_per_incident}")
        return False

    # Gate 2: Estimated cost
    new_total_cost = self.estimated_cost_this_incident + estimated_cost
    if new_total_cost > self.budget.max_estimated_cost_usd:
        logger.info(f"AI cost would exceed budget: ${new_total_cost:.6f} > ${self.budget.max_estimated_cost_usd}")
        return False

    return True
```

**Both gates must pass** (AND logic):

1. Fewer than 2 calls made this incident, AND
2. Estimated cost would stay under $0.15

---

## Token Estimation

```python
def estimate_tokens(self, text: str) -> int:
    """Rough token estimation: ~4 chars per token on average.

    For production, use tiktoken library for accurate per-model counts.
    """
    return max(1, len(text) // 4)
```

**Rule of thumb**: ~1 token per 4 characters, average across English text.

**For production**: Install `tiktoken` and use model-specific encoding:

```python
import tiktoken

def estimate_tokens_tiktoken(self, text: str, model: str) -> int:
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))
```

---

## Recording AI Calls

```python
def record_ai_call(
    self,
    estimated_tokens: int,
    actual_tokens: int,
    estimated_cost: float,
    actual_cost: float
) -> None:
    """Record AI call metrics for audit."""
    self.calls_this_incident += 1
    self.estimated_tokens_this_incident += estimated_tokens
    self.actual_tokens_this_incident += actual_tokens
    self.estimated_cost_this_incident += estimated_cost
    self.cost_this_incident += actual_cost
```

**What gets recorded**:

- Call count (for max 2 gate)
- Estimated tokens/cost (for budget projections)
- Actual tokens/cost (for billing and post-incident analysis)

---

## Incident Reset

```python
def reset_incident(self) -> None:
    """Reset all counters for next incident."""
    self.calls_this_incident = 0
    self.estimated_tokens_this_incident = 0
    self.actual_tokens_this_incident = 0
    self.estimated_cost_this_incident = 0.0
    self.cost_this_incident = 0.0
```

Called after incident resolution or handoff to executor.

---

## Fallback Decision

```python
def should_fallback_to_rule_only(
    self,
    rule_confidence: float,
    estimated_ai_cost: Optional[float] = None
) -> bool:
    """Determine if we should skip AI and use rule-only diagnosis."""

    # Decision 1: Rule confidence sufficient?
    if rule_confidence >= self.budget.rule_confidence_threshold:
        logger.info(f"Rule confidence {rule_confidence:.2f} >= threshold; skip AI")
        return True  # High confidence rule result; don't spend money

    # Decision 2: Can we afford AI?
    if estimated_ai_cost is None:
        # Estimate default cost
        default_input = self.estimate_tokens("incident snapshot")
        default_output = self.estimate_tokens("diagnosis summary")
        estimated_ai_cost = self.estimate_cost(default_input, default_output)

    if not self.can_afford_ai_call(estimated_ai_cost):
        logger.info(f"Cannot afford AI call; using rule-only")
        return True  # Budget exceeded; don't call AI

    return False  # Low confidence + budget available → call AI
```

---

## Example Walkthrough: Budget Enforcement

**Incident starts**:

```
calls_this_incident = 0
estimated_cost_this_incident = 0.0
```

**Rule diagnosis**: confidence 0.60 (low)

**Decision 1: Can we call AI?**

```python
estimated_input = estimate_tokens("incident snapshot")  # 50 tokens
estimated_output = estimate_tokens("diagnosis summary")  # 30 tokens
estimated_cost = estimate_cost(50, 30)  # $0.00015

can_afford_ai_call(0.00015)?
  calls_this_incident (0) >= max_calls (2)? NO
  estimated_cost_this_incident (0.0) + 0.00015 > max (0.15)? NO
  → YES, can afford
```

**Call AI #1**: Success, get diagnosis

**Record call**:

```python
record_ai_call(
    estimated_tokens=50,
    actual_tokens=48,
    estimated_cost=0.00015,
    actual_cost=0.000144
)
# Now:
# calls_this_incident = 1
# estimated_cost_this_incident = 0.00015
# cost_this_incident = 0.000144
```

**AI result**: confidence 0.85 (good!)

**Can we call AI again?** No—confident enough, skip.

**Incident resolves**: Total cost $0.000144 (well under $0.15 budget).

---

## Configuration

### Environment Variables

```bash
# Token model (for pricing)
LLM_MODEL=gpt-3.5-turbo

# Budget (optional, defaults used if not set)
AI_MAX_CALLS_PER_INCIDENT=2
AI_MAX_COST_PER_INCIDENT_USD=0.15
```

### Code-Level Configuration

```python
from backend.governance.token_governor import TokenBudget, TokenGovernor

# Custom budget
custom_budget = TokenBudget(
    max_calls_per_incident=1,  # Stricter: only 1 call
    max_estimated_cost_usd=0.05,  # Stricter: $0.05
    rule_confidence_threshold=0.70,  # Looser: trigger AI at 70% confidence
)

governor = TokenGovernor(budget=custom_budget, model="gpt-3.5-turbo")
```

---

## Test Coverage

| Test                                    | Validates                             |
| --------------------------------------- | ------------------------------------- |
| `test_estimate_tokens`                  | Token estimation (~4 chars per token) |
| `test_estimate_cost`                    | Cost calculation with correct pricing |
| `test_estimate_cost_precision`          | Unrounded cost preserves precision    |
| `test_can_afford_ai_call_within_budget` | Gate passes when within limits        |
| `test_can_afford_ai_call_exceeds_count` | Gate fails when call count maxed      |
| `test_can_afford_ai_call_exceeds_cost`  | Gate fails when cost would exceed     |
| `test_record_ai_call`                   | Metrics recorded correctly            |
| `test_reset_incident`                   | Counters reset after incident         |
| `test_should_fallback_high_confidence`  | Skip AI if rule confidence high       |
| `test_should_fallback_budget_exhausted` | Skip AI if budget exceeded            |

---

## Key Design Principles

1. **Dual-Track Accounting**: Estimated and actual costs tracked separately to prevent budget overruns
2. **No Rounding in Gating Logic**: Full-precision floats ensure small costs aren't rounded to zero
3. **Hard Limits**: Both call count AND cost must be within budget; either gate can block an AI call
4. **Transparent Logging**: Every budget decision logged with reason (confidence threshold, call count, cost)
5. **Configurable Budget**: Budget parameters can be customized per deployment (e.g., stricter for CI/test, looser for production)

---

## Related Documentation

- [02-phase2-llm-fallback.md](02-phase2-llm-fallback.md) — How token governor is used in LLM fallback
- [05-data-contracts.md](05-data-contracts.md) — TokenUsageRecord Pydantic model
- [07-api-endpoints.md](07-api-endpoints.md) — API response includes token tracking
