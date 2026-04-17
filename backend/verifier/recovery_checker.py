from __future__ import annotations

from models.schemas import ThresholdCheck, VerificationOutput


class RecoveryChecker:
    async def check_recovery(self, snapshot, window_seconds: int) -> VerificationOutput:
        memory_pct = self._to_float(snapshot.metrics.memory)
        cpu_pct = self._to_float(snapshot.metrics.cpu)
        restart_delta_5m = float(getattr(snapshot.metrics, "restart_count_delta_5m", 0.0) or 0.0)
        error_rate_rps = float(getattr(snapshot.metrics, "error_rate_rps", 0.0) or 0.0)
        latency_p95_seconds = self._to_float(getattr(snapshot.metrics, "latency_p95_seconds", "0"))

        checks = [
            ThresholdCheck(
                metric="memory_usage_percent",
                threshold=85.0,
                observed=memory_pct,
                passed=memory_pct < 85.0,
            ),
            ThresholdCheck(
                metric="cpu_usage_percent",
                threshold=80.0,
                observed=cpu_pct,
                passed=cpu_pct < 80.0,
            ),
            ThresholdCheck(
                metric="restart_count_delta_5m",
                threshold=1.0,
                observed=restart_delta_5m,
                passed=restart_delta_5m < 1.0,
            ),
            ThresholdCheck(
                metric="error_rate_rps",
                threshold=2.0,
                observed=error_rate_rps,
                passed=error_rate_rps < 2.0,
            ),
            ThresholdCheck(
                metric="latency_p95_seconds",
                threshold=1.5,
                observed=latency_p95_seconds,
                passed=latency_p95_seconds < 1.5,
            ),
        ]
        recovered = all(check.passed for check in checks)
        if recovered:
            reason = "all thresholds passed in verification window"
        else:
            failed_metrics = [check.metric for check in checks if not check.passed]
            reason = f"threshold regression detected: {', '.join(failed_metrics)}"

        return VerificationOutput(
            verification_window_seconds=window_seconds,
            thresholds_checked=checks,
            recovered=recovered,
            close_reason=reason,
        )

    @staticmethod
    def _to_float(raw: object) -> float:
        text = str(raw or "0").strip().lower()
        if not text:
            return 0.0
        for suffix in ("%", "x", "ms", "s"):
            if text.endswith(suffix):
                text = text[: -len(suffix)].strip()
                break
        try:
            return float(text)
        except (TypeError, ValueError):
            return 0.0
