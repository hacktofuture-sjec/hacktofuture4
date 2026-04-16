# AI Prompt and JSON Shape Contract

Owner: Rajatha

## Diagnose Output (strict JSON)

- root_cause: string
- confidence: float
- affected_services: string[]
- evidence: string[]
- structured_reasoning: object

## Planner Output (strict JSON)

- candidate_actions: object[]
- selected_action: object
- risk_level: string
- approval_required: boolean
- justification: string

## Fallback Rule

If parse fails or budget gate blocks call, return deterministic rule-based output with clear reason.
