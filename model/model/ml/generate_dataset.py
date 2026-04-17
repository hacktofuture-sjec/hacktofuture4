"""
generate_dataset.py
-------------------
Generates a synthetic telemetry dataset for failure classification.
Each row simulates a Kubernetes service's health snapshot with 10 features
and a target label from: healthy, latency_issue, service_error, crash_loop, overload.

Design philosophy:
  - Classes are distinguished by *combinations* of features, not any single one.
  - Feature ranges overlap meaningfully between classes (e.g. a healthy service
    can occasionally have moderate latency; an overloaded service can have
    moderate error_count similar to service_error).
  - Gaussian noise is added to every numeric feature to create realistic
    variability and boundary ambiguity.
  - Roughly 5-10% of samples per class are intentionally "borderline" to
    prevent trivial separation.

Usage:
    python generate_dataset.py
"""

import os
import random
import pandas as pd
import numpy as np

# -- Configuration ------------------------------------------------------------
TOTAL_ROWS = 750  # Target row count (between 500-1000)
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "telemetry_dataset.csv")
RANDOM_SEED = 42

# Class names and per-class sample counts (balanced distribution)
CLASSES = ["healthy", "latency_issue", "service_error", "crash_loop", "overload"]
ROWS_PER_CLASS = TOTAL_ROWS // len(CLASSES)  # 150 each


# -- Utility helpers -----------------------------------------------------------

def _gauss(mean, std, lo=None, hi=None):
    """Sample from a Gaussian, optionally clamped to [lo, hi]."""
    val = random.gauss(mean, std)
    if lo is not None:
        val = max(lo, val)
    if hi is not None:
        val = min(hi, val)
    return val


def _rand(low, high):
    """Uniform random float between low and high."""
    return random.uniform(low, high)


def _randint(low, high):
    """Uniform random integer between low and high (inclusive)."""
    return random.randint(low, high)


# -- Per-class generators ------------------------------------------------------
# Each generator uses Gaussian distributions (not uniform) so that most samples
# cluster around typical values but tails bleed into neighboring class ranges.
# This creates natural overlap without making classes random.

def generate_healthy():
    """
    Healthy: low-moderate CPU/memory, low latency, near-zero errors/restarts,
    moderate traffic, all replicas available, reachable.
    Overlap zones: can occasionally show moderate latency (overlapping with
    latency_issue), or a few errors (overlapping with service_error).
    """
    replicas = _randint(2, 5)
    return {
        "cpu_percent": round(_gauss(28, 16, lo=3, hi=70), 1),
        "memory_mb": round(_gauss(320, 160, lo=50, hi=800), 1),
        "latency_ms": round(_gauss(50, 45, lo=3, hi=350), 1),       # wider tail overlaps latency_issue
        "restart_count": max(0, int(_gauss(0.5, 1.2))),              # mostly 0, occasionally 1-3
        "error_count": max(0, int(_gauss(3, 5))),                    # mostly 0-5, tail reaches ~15
        "requests_per_sec": round(_gauss(160, 70, lo=15, hi=400), 1),
        "active_connections": max(5, int(_gauss(65, 40))),
        "replicas": replicas,
        "available_replicas": replicas - (1 if random.random() < 0.03 else 0),
        "is_reachable": 1 if random.random() < 0.97 else 0,
    }


def generate_latency_issue():
    """
    Latency issue: the defining signal is high latency (500-5000ms).
    CPU/memory are moderate (overlapping with healthy and service_error).
    Errors are low-moderate. Restarts near zero. Still reachable.
    Overlap zones: moderate-range latency samples overlap with healthy
    upper range or service_error; error_count tail overlaps service_error.
    """
    replicas = _randint(2, 5)
    return {
        "cpu_percent": round(_gauss(38, 18, lo=8, hi=80), 1),        # wider, overlaps healthy/service_error/crash
        "memory_mb": round(_gauss(440, 180, lo=80, hi=1000), 1),     # wider overlap
        "latency_ms": round(_gauss(900, 700, lo=120, hi=5000), 1),   # KEY: high, but lower tail now reaches ~120
        "restart_count": max(0, int(_gauss(0.8, 1.5))),              # mostly 0-2, tail can reach 4
        "error_count": max(0, int(_gauss(10, 10))),                   # low-moderate, wider tail into service_error
        "requests_per_sec": round(_gauss(130, 70, lo=8, hi=400), 1), # overlaps healthy range
        "active_connections": max(5, int(_gauss(85, 50))),           # wider spread
        "replicas": replicas,
        "available_replicas": replicas - (1 if random.random() < 0.08 else 0),
        "is_reachable": 1 if random.random() < 0.90 else 0,
    }


def generate_service_error():
    """
    Service error: the defining signal is high error_count.
    CPU/memory/latency are moderate (overlapping with healthy and latency_issue).
    Restarts can be low-moderate. Traffic may be reduced.
    Overlap zones: error_count lower tail overlaps crash_loop & healthy;
    latency upper tail overlaps latency_issue; restart tail overlaps crash_loop.
    """
    replicas = _randint(2, 5)
    return {
        "cpu_percent": round(_gauss(38, 18, lo=5, hi=75), 1),       # broader, overlaps healthy/crash_loop
        "memory_mb": round(_gauss(420, 160, lo=60, hi=900), 1),     # broader overlap
        "latency_ms": round(_gauss(180, 150, lo=15, hi=800), 1),    # wider tail into latency_issue
        "restart_count": max(0, int(_gauss(1.5, 2.5))),             # mostly 0-3, tail reaches 6-8 (crash_loop overlap)
        "error_count": max(5, int(_gauss(50, 35))),                  # KEY: high. Lower tail ~5 overlaps healthy/crash
        "requests_per_sec": round(_gauss(95, 60, lo=3, hi=320), 1), # slightly lower than healthy
        "active_connections": max(3, int(_gauss(50, 30))),           # moderate
        "replicas": replicas,
        "available_replicas": replicas - (1 if random.random() < 0.18 else 0),
        "is_reachable": 1 if random.random() < 0.80 else 0,
    }


def generate_crash_loop():
    """
    Crash loop: the defining signal is high restart_count with
    available_replicas < replicas. Errors moderate-high.
    Overlap zones: restart_count lower tail approaches service_error upper tail;
    error_count significantly overlaps service_error; latency overlaps latency_issue;
    cpu can overlap with overload lower range.
    """
    replicas = _randint(2, 5)
    # Key: available replicas lower than desired (but sometimes only slightly)
    replica_deficit = _randint(0, min(3, replicas))  # 0 deficit possible now
    available = max(0, replicas - replica_deficit)

    return {
        "cpu_percent": round(_gauss(48, 22, lo=8, hi=92), 1),       # wider, upper tail overlaps overload
        "memory_mb": round(_gauss(520, 220, lo=80, hi=1200), 1),    # wider, overlaps overload lower range
        "latency_ms": round(_gauss(550, 450, lo=30, hi=3000), 1),   # wider, more overlap with latency_issue
        "restart_count": max(2, int(_gauss(14, 10))),                # KEY: high but lower tail ~2-4 approaches service_error
        "error_count": max(1, int(_gauss(30, 22))),                  # significant overlap with service_error
        "requests_per_sec": round(_gauss(65, 45, lo=2, hi=250), 1), # reduced, but upper tail touches healthy
        "active_connections": max(1, int(_gauss(35, 28))),           # wider spread
        "replicas": replicas,
        "available_replicas": available,
        "is_reachable": 1 if random.random() < 0.50 else 0,
    }


def generate_overload():
    """
    Overload: the defining signal is the *combination* of very high CPU,
    memory, requests/sec, and active connections. Individual features can
    overlap with other classes.
    Overlap zones: cpu lower tail overlaps crash_loop heavily;
    error_count overlaps service_error; latency overlaps latency_issue;
    memory lower tail overlaps crash_loop.
    """
    replicas = _randint(1, 3)  # low replicas relative to demand
    return {
        "cpu_percent": round(_gauss(82, 14, lo=50, hi=100), 1),     # KEY: high, but lower tail (50-65) overlaps crash_loop
        "memory_mb": round(_gauss(1300, 400, lo=400, hi=2500), 1),  # KEY: high, lower tail overlaps crash_loop
        "latency_ms": round(_gauss(1200, 800, lo=80, hi=5000), 1),  # high, heavy overlap with latency_issue
        "restart_count": max(0, int(_gauss(4, 4))),                  # moderate, overlaps crash_loop lower tail more
        "error_count": max(2, int(_gauss(50, 35))),                  # high, heavy overlap with service_error
        "requests_per_sec": round(_gauss(1000, 450, lo=200, hi=2500), 1),  # KEY: high but lower tail approaches healthy
        "active_connections": max(30, int(_gauss(400, 220))),        # KEY: high but lower tail approaches crash_loop
        "replicas": replicas,
        "available_replicas": replicas - (1 if random.random() < 0.22 else 0),
        "is_reachable": 1 if random.random() < 0.62 else 0,
    }


# Map class names to their generators
GENERATORS = {
    "healthy": generate_healthy,
    "latency_issue": generate_latency_issue,
    "service_error": generate_service_error,
    "crash_loop": generate_crash_loop,
    "overload": generate_overload,
}


def _inject_noise(df, noise_fraction=0.12, seed=42):
    """
    Post-generation noise injection: randomly perturb a fraction of rows
    to simulate realistic sensor noise and ambiguous telemetry snapshots.
    This prevents any single feature from being a perfect class separator.
    """
    rng = np.random.RandomState(seed)
    n_noisy = int(len(df) * noise_fraction)
    noisy_idx = rng.choice(df.index, size=n_noisy, replace=False)

    numeric_cols = [
        "cpu_percent", "memory_mb", "latency_ms", "restart_count",
        "error_count", "requests_per_sec", "active_connections",
    ]

    for idx in noisy_idx:
        # Pick 2-4 random features to perturb
        n_features = rng.randint(2, 5)
        cols_to_perturb = rng.choice(numeric_cols, size=n_features, replace=False)

        for col in cols_to_perturb:
            original = df.at[idx, col]
            # Add +/- 20-60% noise
            noise_pct = rng.uniform(0.2, 0.6) * rng.choice([-1, 1])
            noisy_val = original * (1 + noise_pct)
            # Keep values non-negative and round appropriately
            if col in ("restart_count", "error_count", "active_connections"):
                df.at[idx, col] = max(0, int(round(noisy_val)))
            else:
                df.at[idx, col] = round(max(0.0, noisy_val), 1)

    # Clamp cpu_percent to [0, 100]
    df["cpu_percent"] = df["cpu_percent"].clip(0, 100)

    return df


def generate_dataset():
    """Generate the full synthetic dataset and save it as CSV."""
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    rows = []
    for class_name in CLASSES:
        gen_fn = GENERATORS[class_name]
        for _ in range(ROWS_PER_CLASS):
            row = gen_fn()
            row["label"] = class_name
            rows.append(row)

    df = pd.DataFrame(rows)

    # Post-generation noise injection for realism
    df = _inject_noise(df, noise_fraction=0.12, seed=RANDOM_SEED)

    # Shuffle so classes aren't in order
    df = df.sample(frac=1, random_state=RANDOM_SEED).reset_index(drop=True)

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)

    # -- Summary ---------------------------------------------------------------
    print(f"[OK] Dataset generated: {OUTPUT_FILE}")
    print(f"    Total rows : {len(df)}")
    print(f"\n    Class distribution:")
    for cls, count in df["label"].value_counts().sort_index().items():
        print(f"      {cls:20s} : {count}")

    # Show per-class feature means for sanity checking
    print(f"\n    Per-class feature means (sanity check):")
    means = df.groupby("label").mean(numeric_only=True).round(1)
    print(means.to_string(index=True))

    return df


if __name__ == "__main__":
    generate_dataset()
