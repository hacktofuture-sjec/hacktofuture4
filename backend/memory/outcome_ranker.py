from __future__ import annotations


class OutcomeRanker:
    @staticmethod
    def rank(rows: list[dict]) -> list[dict]:
        return sorted(rows, key=lambda item: (-item.get("success_rate", 0), item.get("median_recovery_seconds", 10**9)))
