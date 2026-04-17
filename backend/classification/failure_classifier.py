from __future__ import annotations

from models.enums import FailureClass


class FailureClassifier:
    @staticmethod
    def classify(features: dict, events: list[dict], logs_summary: list[dict]) -> FailureClass:
        reasons = {event.get("reason", "") for event in events}
        signatures = " ".join(entry.get("signature", "").lower() for entry in logs_summary)

        if "OOMKilled" in reasons or features.get("memory_usage_percent", 0) >= 90:
            return FailureClass.RESOURCE_EXHAUSTION
        if "CrashLoopBackOff" in reasons or "crash" in signatures:
            return FailureClass.APPLICATION_CRASH
        if "ImagePullBackOff" in reasons or "image" in signatures:
            return FailureClass.CONFIG_ERROR
        if "FailedScheduling" in reasons:
            return FailureClass.INFRA_SATURATION
        if features.get("latency_delta_ratio", 1.0) > 2.0 or "timeout" in signatures:
            return FailureClass.DEPENDENCY_FAILURE
        return FailureClass.UNKNOWN
