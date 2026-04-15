#!/usr/bin/env python3
"""
train.py — standalone script to train the baseline IsolationForest model.

Usage:
    python train.py
    python train.py --samples 2000 --contamination 0.05 --estimators 150
"""

import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Train ML anomaly-detection baseline model")
    parser.add_argument("--samples",       type=int,   default=1000,  help="Number of synthetic training samples")
    parser.add_argument("--contamination", type=float, default=0.05,  help="Expected fraction of anomalies (0–0.5)")
    parser.add_argument("--estimators",    type=int,   default=100,   help="Number of trees in IsolationForest")
    args = parser.parse_args()

    # Ensure the saved_model directory exists
    os.makedirs("saved_model", exist_ok=True)

    print("=" * 55)
    print("  Nova Chat ML Service — Baseline Model Trainer")
    print("=" * 55)
    print(f"  Samples       : {args.samples}")
    print(f"  Contamination : {args.contamination}")
    print(f"  Estimators    : {args.estimators}")
    print("-" * 55)

    # Import here so the script can be run from any cwd
    sys.path.insert(0, os.path.dirname(__file__))
    from model import train_baseline_model, MODEL_PATH, FEATURES

    model, n = train_baseline_model(
        n_samples=args.samples,
        contamination=args.contamination,
        n_estimators=args.estimators,
    )

    print(f"  ✓ Trained IsolationForest on {n} synthetic samples")
    print(f"  ✓ Features    : {FEATURES}")
    print(f"  ✓ Model saved : {MODEL_PATH}")
    print("=" * 55)
    print("  Training complete. ML service is ready.")
    print("=" * 55)


if __name__ == "__main__":
    main()
