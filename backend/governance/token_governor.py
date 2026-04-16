from dataclasses import dataclass
from typing import Optional


@dataclass
class TokenBudget:
    max_calls_per_incident: int = 2
    max_estimated_cost_usd: float = 0.15
    rule_confidence_threshold: float = 0.75


class TokenGovernor:
    """
    Governance layer for AI token usage and cost enforcement.
    Ensures budget caps and cost tracking for all AI calls.
    """

    # Model pricing (example rates - adjust per actual model)
    # Rates are per token; divide per-1M-token price by 1_000_000.
    MODEL_PRICING = {
        "gpt-4": {"input": 30.0 / 1_000_000, "output": 60.0 / 1_000_000},
        "gpt-3.5-turbo": {"input": 0.5 / 1_000_000, "output": 1.5 / 1_000_000},
        "claude": {"input": 8.0 / 1_000_000, "output": 24.0 / 1_000_000},
    }

    def __init__(self, budget: Optional[TokenBudget] = None, model: str = "gpt-3.5-turbo") -> None:
        self.budget = budget or TokenBudget()
        self.model = model
        self.calls_this_incident = 0
        self.cost_this_incident = 0.0
        self.estimated_tokens_this_incident = 0
        self.actual_tokens_this_incident = 0
        self.estimated_cost_this_incident = 0.0

    def estimate_tokens(self, text: str) -> int:
        """
        Rough token estimation: ~4 chars per token on average.
        For production, use tiktoken library.
        """
        return max(1, len(text) // 4)

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost based on token count and model pricing."""
        pricing = self.MODEL_PRICING.get(self.model, self.MODEL_PRICING["gpt-3.5-turbo"])
        input_cost = input_tokens * pricing["input"]
        output_cost = output_tokens * pricing["output"]
        return round(input_cost + output_cost, 6)

    def can_afford_ai_call(self, estimated_cost: float) -> bool:
        """Check if AI call is within the estimated-cost budget."""
        if self.calls_this_incident >= self.budget.max_calls_per_incident:
            return False
        if (self.estimated_cost_this_incident + estimated_cost) > self.budget.max_estimated_cost_usd:
            return False
        return True

    def record_ai_call(self, estimated_tokens: int, actual_tokens: int, estimated_cost: float, actual_cost: float) -> None:
        """Record AI call metrics."""
        self.calls_this_incident += 1
        self.estimated_tokens_this_incident += estimated_tokens
        self.actual_tokens_this_incident += actual_tokens
        self.estimated_cost_this_incident += estimated_cost
        self.cost_this_incident += actual_cost

    def reset_incident(self) -> None:
        """Reset counters for next incident."""
        self.calls_this_incident = 0
        self.estimated_tokens_this_incident = 0
        self.actual_tokens_this_incident = 0
        self.estimated_cost_this_incident = 0.0
        self.cost_this_incident = 0.0

    def should_fallback_to_rule_only(self, rule_confidence: float, estimated_ai_cost: Optional[float] = None) -> bool:
        """Determine if we should use rule-only path based on confidence."""
        if rule_confidence >= self.budget.rule_confidence_threshold:
            return True  # High confidence, skip AI

        if estimated_ai_cost is None:
            default_input = self.estimate_tokens("incident snapshot")
            default_output = self.estimate_tokens("diagnosis summary")
            estimated_ai_cost = self.estimate_cost(default_input, default_output)

        if not self.can_afford_ai_call(estimated_ai_cost):
            return True  # Out of budget
        return False

