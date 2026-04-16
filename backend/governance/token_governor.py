from __future__ import annotations

from dataclasses import dataclass

import tiktoken


@dataclass
class BudgetDecision:
    allowed: bool
    reason: str | None


class TokenGovernor:
    MODEL_PRICING = {
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4o": {"input": 5.00, "output": 15.00},
    }

    def __init__(self, model_name: str, budget_cap_per_incident: float, budget_cap_per_run: float):
        self.model_name = model_name
        self.budget_cap_per_incident = budget_cap_per_incident
        self.budget_cap_per_run = budget_cap_per_run
        try:
            self.encoder = tiktoken.encoding_for_model(model_name)
        except Exception:
            self.encoder = tiktoken.get_encoding("cl100k_base")

    def estimate(self, prompt: str) -> dict:
        tokens = len(self.encoder.encode(prompt))
        pricing = self.MODEL_PRICING.get(self.model_name, self.MODEL_PRICING["gpt-4o-mini"])
        estimated_cost = (tokens / 1_000_000) * pricing["input"]
        return {"tokens": tokens, "estimated_cost_usd": estimated_cost}

    def compute_actual_cost(self, input_tokens: int, output_tokens: int) -> float:
        pricing = self.MODEL_PRICING.get(self.model_name, self.MODEL_PRICING["gpt-4o-mini"])
        return ((input_tokens / 1_000_000) * pricing["input"]) + ((output_tokens / 1_000_000) * pricing["output"])

    def check_budget(self, estimated_cost: float, incident_accumulated: float, run_accumulated: float) -> BudgetDecision:
        if incident_accumulated + estimated_cost > self.budget_cap_per_incident:
            return BudgetDecision(allowed=False, reason="budget_exceeded")
        if run_accumulated + estimated_cost > self.budget_cap_per_run:
            return BudgetDecision(allowed=False, reason="budget_exceeded")
        return BudgetDecision(allowed=True, reason=None)

    def record_usage(
        self,
        db,
        incident_id: str,
        stage: str,
        input_tokens: int,
        output_tokens: int,
        estimated_cost: float,
        actual_cost: float,
        fallback_triggered: bool,
        reason: str | None,
    ) -> None:
        db.execute(
            """INSERT INTO token_usage
               (incident_id, stage, model_name, input_tokens, output_tokens,
                estimated_cost_usd, actual_cost_usd, fallback_triggered, reason, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (
                incident_id,
                stage,
                self.model_name,
                input_tokens,
                output_tokens,
                estimated_cost,
                actual_cost,
                int(fallback_triggered),
                reason,
            ),
        )
        db.commit()


def get_incident_ai_spend(db, incident_id: str) -> float:
    row = db.execute("SELECT COALESCE(SUM(actual_cost_usd), 0.0) FROM token_usage WHERE incident_id=?", (incident_id,)).fetchone()
    return float(row[0] or 0.0)


def get_run_ai_spend(db) -> float:
    row = db.execute("SELECT COALESCE(SUM(actual_cost_usd), 0.0) FROM token_usage").fetchone()
    return float(row[0] or 0.0)
