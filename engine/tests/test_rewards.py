"""
Unit tests for the RL reward signal computation.
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

import pytest
from rekall_engine.rl.rewards import compute_reward, REWARD_MAP


class TestComputeReward:
    def test_success_tier1_returns_positive(self):
        r = compute_reward("success", "T1_human")
        assert r > 0, "successful T1 fix should earn positive reward"

    def test_success_tier3_highest_gain(self):
        r_t1 = compute_reward("success", "T1_human")
        r_t3 = compute_reward("success", "T3_llm")
        assert r_t3 > r_t1, "T3 success should earn the most (new knowledge)"

    def test_failure_all_tiers_negative(self):
        for tier in ("T1_human", "T2_synthetic", "T3_llm"):
            assert compute_reward("failure", tier) < 0, f"failure/{tier} must be negative"

    def test_rejected_all_tiers_negative(self):
        for tier in ("T1_human", "T2_synthetic", "T3_llm"):
            assert compute_reward("rejected", tier) < 0

    def test_failure_worse_than_rejected(self):
        r_fail = compute_reward("failure", "T1_human")
        r_rej  = compute_reward("rejected", "T1_human")
        assert r_fail < r_rej, "failure penalises more than rejection"

    def test_unknown_pair_returns_zero(self):
        assert compute_reward("unknown", "T9_magic") == 0.0

    def test_all_defined_pairs_are_reachable(self):
        for (result, tier), expected in REWARD_MAP.items():
            got = compute_reward(result, tier)
            assert got == expected, f"REWARD_MAP mismatch for ({result}, {tier})"

    def test_reward_values_within_sane_range(self):
        for val in REWARD_MAP.values():
            assert -1.0 <= val <= 1.0, "rewards should be in [-1, 1]"
