"""
feature_engineering.py
----------------------
Stage 2: Time Window / Trend Feature Engineering

Instead of classifying a single telemetry snapshot, this module takes a
sliding window of the last N readings and computes trend features:
  - cpu_trend:            slope of CPU over the window
  - latency_trend:        slope of latency over the window
  - restart_growth_rate:  rate of restart count increase
  - error_rate_trend:     slope of error count
  - memory_trend:         slope of memory usage

These are appended to the latest reading's features for richer classification.
"""

import numpy as np


def _compute_slope(values):
    """
    Compute the slope of a series using simple linear regression.
    Positive = increasing, Negative = decreasing, ~0 = stable.
    Returns slope normalised by the mean to make it comparable across features.
    """
    n = len(values)
    if n < 2:
        return 0.0

    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)

    mean_y = np.mean(y)
    if mean_y == 0:
        mean_y = 1.0  # avoid division by zero

    # Slope from least-squares: slope = cov(x,y) / var(x)
    slope = np.polyfit(x, y, 1)[0]

    # Normalise by mean so that a 10-unit rise matters differently
    # for CPU (0-100) vs latency (0-5000)
    return round(slope / mean_y, 4)


def build_temporal_features(window_data: list[dict]) -> dict:
    """
    Build trend features from a sliding window of telemetry snapshots.

    Args:
        window_data: list of validated telemetry dicts, ordered oldest-first.
                     Typically 3-5 readings.

    Returns:
        dict with the latest reading's features PLUS trend features.
    """
    if not window_data:
        raise ValueError("window_data must contain at least 1 reading")

    # If only one reading, trends are all zero (no history)
    latest = dict(window_data[-1])

    if len(window_data) < 2:
        latest["cpu_trend"] = 0.0
        latest["latency_trend"] = 0.0
        latest["restart_growth_rate"] = 0.0
        latest["error_rate_trend"] = 0.0
        latest["memory_trend"] = 0.0
        return latest

    # Extract series for each trended feature
    cpu_series = [r["cpu_percent"] for r in window_data]
    latency_series = [r["latency_ms"] for r in window_data]
    restart_series = [r["restart_count"] for r in window_data]
    error_series = [r["error_count"] for r in window_data]
    memory_series = [r["memory_mb"] for r in window_data]

    # Compute normalised slopes
    latest["cpu_trend"] = _compute_slope(cpu_series)
    latest["latency_trend"] = _compute_slope(latency_series)
    latest["restart_growth_rate"] = _compute_slope(restart_series)
    latest["error_rate_trend"] = _compute_slope(error_series)
    latest["memory_trend"] = _compute_slope(memory_series)

    return latest
