"""
Unit tests for the ConfidenceModel (decay and reward application).
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from datetime import datetime, timedelta
import pytest
from rekall_engine.rl.confidence import decay_confidence, apply_reward, MIN_CONFIDENCE, MAX_CONFIDENCE
from rekall_engine.types import VaultEntry


def _make_entry(confidence: float, days_old: int = 0) -> VaultEntry:
    created = datetime.utcnow() - timedelta(days=days_old)
    return VaultEntry(
        id="test-id",
        failure_signature="sig",
        failure_type="infra",
        fix_description="fix it",
        fix_commands=[],
        fix_diff=None,
        confidence=confidence,
        retrieval_count=0,
        success_count=0,
        source="human",
        created_at=created,
    )


class TestDecayConfidence:
    def test_fresh_entry_unchanged(self):
        entry = _make_entry(confidence=0.9, days_old=0)
        result = decay_confidence(entry)
        assert result == pytest.approx(0.9, rel=1e-3)

    def test_older_entry_lower_confidence(self):
        fresh = decay_confidence(_make_entry(0.9, days_old=0))
        old   = decay_confidence(_make_entry(0.9, days_old=365))
        assert old < fresh

    def test_never_below_minimum(self):
        entry = _make_entry(confidence=0.1, days_old=10_000)
        result = decay_confidence(entry)
        assert result >= MIN_CONFIDENCE

    def test_high_confidence_decays_toward_minimum(self):
        entry = _make_entry(confidence=1.0, days_old=3000)
        result = decay_confidence(entry)
        assert result >= MIN_CONFIDENCE
        assert result < 1.0


class TestApplyReward:
    def test_positive_reward_increases_confidence(self):
        new_conf = apply_reward(0.7, 0.1)
        assert new_conf > 0.7

    def test_negative_reward_decreases_confidence(self):
        new_conf = apply_reward(0.7, -0.2)
        assert new_conf < 0.7

    def test_clamps_at_maximum(self):
        new_conf = apply_reward(0.99, 0.5)
        assert new_conf == MAX_CONFIDENCE

    def test_clamps_at_minimum(self):
        new_conf = apply_reward(0.15, -1.0)
        assert new_conf == MIN_CONFIDENCE

    def test_zero_reward_unchanged(self):
        new_conf = apply_reward(0.65, 0.0)
        assert new_conf == pytest.approx(0.65)
