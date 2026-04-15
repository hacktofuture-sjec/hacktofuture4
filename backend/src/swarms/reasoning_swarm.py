from __future__ import annotations


class ReasoningSwarm:
    def _suggest_action(self, query: str) -> str:
        normalized = query.lower()
        if any(word in normalized for word in ["rollback", "revert", "jira", "slack", "deploy", "pr"]):
            return "create rollback PR and notify Slack and Jira"
        if any(word in normalized for word in ["cpu", "latency", "incident", "redis"]):
            return "run high CPU diagnostic runbook in read-only mode"
        return "summarize findings and request approval for external actions"

    def run(self, context: dict) -> dict:
        query = context.get("query", "")
        sources = context.get("sources", [])

        if not sources:
            return {
                "reasoning": "No indexed evidence was found; provide more context or ingest more runbooks.",
                "answer": "I could not find enough evidence in the current knowledge base.",
                "suggested_action": "collect additional context before taking action",
                "confidence": 0.25,
                "sources": [],
            }

        top_sources = sources[:3]
        source_titles = ", ".join(source["title"] for source in top_sources)
        answer = (
            f"Based on {len(sources)} relevant sources ({source_titles}), the issue appears linked "
            "to recent operational context. Start with the documented runbook path and only execute "
            "external actions after explicit approval."
        )

        return {
            "reasoning": "Correlated query intent with indexed runbooks/incidents and selected top evidence.",
            "answer": answer,
            "suggested_action": self._suggest_action(query),
            "confidence": min(0.95, 0.45 + (0.1 * len(sources))),
            "sources": top_sources,
        }
