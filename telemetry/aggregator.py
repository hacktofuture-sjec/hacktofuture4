# What it does:

# Combines telemetry into one signal packet.

# PPT Module:

# Signal Aggregation
from telemetry.prometheus_fetcher import fetch_metrics
from telemetry.otel_collector import collect_traces_logs

def collect_signals():
    metrics = fetch_metrics()
    traces = collect_traces_logs()

    return {
        "cpu": metrics["cpu"],
        "memory": metrics["memory"],
        "restarts": traces["restarts"],
        "latency": traces["latency"],
        "error_rate": traces["error_rate"]
    }