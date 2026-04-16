from __future__ import annotations


class TraceDependencyMapper:
    @staticmethod
    def summarize(trace_summary: dict | None, service: str) -> str:
        if not trace_summary:
            return f"{service} -> dependencies (trace not triggered)"

        path = trace_summary.get("suspected_path", f"edge -> {service}")
        hot_span = trace_summary.get("hot_span", "unknown")
        return f"{path} (bottleneck: {hot_span})"
