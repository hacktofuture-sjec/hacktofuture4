from __future__ import annotations

from models.schemas import ThresholdCheck, VerificationOutput


class RecoveryChecker:
    async def check_recovery(self, snapshot, window_seconds: int) -> VerificationOutput:
        memory_pct = int(snapshot.metrics.memory.replace("%", "") or 0)
        cpu_pct = int(snapshot.metrics.cpu.replace("%", "") or 0)

        checks = [
            ThresholdCheck(metric="memory_percent", threshold=90.0, observed=float(memory_pct), passed=memory_pct < 90),
            ThresholdCheck(metric="cpu_percent", threshold=90.0, observed=float(cpu_pct), passed=cpu_pct < 90),
        ]
        recovered = all(check.passed for check in checks)
        reason = "all thresholds passed in verification window" if recovered else "threshold regression detected"

        return VerificationOutput(
            verification_window_seconds=window_seconds,
            thresholds_checked=checks,
            recovered=recovered,
            close_reason=reason,
        )
