#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json

import httpx

BASE = "http://localhost:8000"


def run_scenario(scenario_id: str) -> bool:
    print(f"Running scenario: {scenario_id}")

    response = httpx.post(
        f"{BASE}/inject-fault",
        json={"scenario_id": scenario_id, "force": True},
        timeout=300,
    )
    if response.status_code != 200:
        print("Inject failed", response.status_code, response.text)
        return False

    print(json.dumps(response.json(), indent=2))
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default="oom-kill-001")
    args = parser.parse_args()
    return 0 if run_scenario(args.scenario) else 1


if __name__ == "__main__":
    raise SystemExit(main())
