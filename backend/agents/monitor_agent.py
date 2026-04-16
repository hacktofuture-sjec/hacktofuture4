from __future__ import annotations


class MonitorAgent:
    @staticmethod
    def compute_confidence(features: dict, events: list[dict], logs_summary: list[dict]) -> float:
        score = 0.35
        if features.get("memory_anomaly") or features.get("cpu_anomaly"):
            score += 0.2
        if features.get("restart_burst"):
            score += 0.15
        if features.get("latency_anomaly"):
            score += 0.15
        if events:
            score += 0.1
        if logs_summary:
            score += 0.1
        return max(0.0, min(1.0, score))
