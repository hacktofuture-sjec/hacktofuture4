"""
Comprehensive tests for diagnosis rule engine and feature extraction.
Verifiable at each step.
"""

import sys
from pathlib import Path

# Add backend to path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from diagnosis.rule_engine import match_fingerprint, FINGERPRINT_CATALOG
from diagnosis.feature_extractor import extract_features


def test_fingerprint_oom_kill():
    """Test FP-001: OOM Kill detection."""
    snapshot = {
        "metrics": {"memory_pct": 95.0, "cpu_pct": 40.0, "restart_count": 1},
        "events": ["OOMKilled event detected"],
        "logs_summary": [],
    }
    result = match_fingerprint(snapshot)
    assert result is not None, "OOM fingerprint should match"
    assert result["fingerprint_id"] == "FP-001", f"Expected FP-001, got {result['fingerprint_id']}"
    assert result["confidence"] >= 0.90, "OOM confidence should be high"
    print("✓ FP-001 (OOM Kill) detection passed")


def test_fingerprint_crash_loop():
    """Test FP-002: CrashLoop detection."""
    snapshot = {
        "metrics": {"memory_pct": 30.0, "cpu_pct": 50.0, "restart_count": 5},
        "events": ["CrashLoopBackOff detected"],
        "logs_summary": [{"signature": "panic: runtime error"}],
    }
    result = match_fingerprint(snapshot)
    assert result is not None, "CrashLoop fingerprint should match"
    assert result["fingerprint_id"] == "FP-002", f"Expected FP-002, got {result['fingerprint_id']}"
    print("✓ FP-002 (CrashLoop) detection passed")


def test_fingerprint_image_pull():
    """Test FP-003: Image pull failure detection."""
    snapshot = {
        "metrics": {"memory_pct": 10.0, "cpu_pct": 5.0, "restart_count": 0},
        "events": ["ImagePullBackOff event"],
        "logs_summary": [],
    }
    result = match_fingerprint(snapshot)
    assert result is not None, "ImagePull fingerprint should match"
    assert result["fingerprint_id"] == "FP-003", f"Expected FP-003, got {result['fingerprint_id']}"
    print("✓ FP-003 (ImagePull) detection passed")


def test_fingerprint_cpu_starvation():
    """Test FP-004: CPU starvation detection."""
    snapshot = {
        "metrics": {"memory_pct": 50.0, "cpu_pct": 95.0, "restart_count": 0},
        "events": ["Pod running but slow"],
        "logs_summary": [],
    }
    result = match_fingerprint(snapshot)
    assert result is not None, "CPU starvation fingerprint should match"
    assert result["fingerprint_id"] == "FP-004", f"Expected FP-004, got {result['fingerprint_id']}"
    print("✓ FP-004 (CPU Starvation) detection passed")


def test_fingerprint_no_match():
    """Test no fingerprint match when conditions don't align."""
    snapshot = {
        "metrics": {"memory_pct": 30.0, "cpu_pct": 30.0, "restart_count": 1},
        "events": ["Some random event"],
        "logs_summary": [],
    }
    result = match_fingerprint(snapshot)
    assert result is None, "No fingerprint should match for normal conditions"
    print("✓ No-match test passed")


def test_feature_extraction_oom_case():
    """Test feature extraction for OOM scenario."""
    snapshot = {
        "metrics": {"memory_pct": 92.0, "cpu_pct": 45.0, "restart_count": 2, "latency_delta": 0.5},
        "events": ["OOMKilled"],
        "logs_summary": [{"signature": "killed due to out of memory"}],
    }
    features = extract_features(snapshot)
    assert features["memory_pct"] == 92.0, "Memory percent extraction failed"
    assert features["oom_event_count"] > 0, "OOM event count should be > 0"
    assert features["memory_z_score"] > 2.0, "High memory should have high Z-score"
    print("✓ Feature extraction (OOM) passed")
    print(f"  Extracted features: {features}")


def test_feature_extraction_cpu_case():
    """Test feature extraction for CPU spike scenario."""
    snapshot = {
        "metrics": {"memory_pct": 50.0, "cpu_pct": 88.0, "restart_count": 0, "latency_delta": 1.2},
        "events": ["High CPU usage"],
        "logs_summary": [{"signature": "request timeout"}],
    }
    features = extract_features(snapshot)
    assert features["cpu_pct"] == 88.0, "CPU percent extraction failed"
    assert features["cpu_z_score"] > 3.0, "High CPU should have high Z-score"
    assert features["timeout_log_count"] > 0, "Timeout logs should be detected"
    print("✓ Feature extraction (CPU) passed")
    print(f"  Extracted features: {features}")


def test_catalog_completeness():
    """Verify catalog has required fingerprints."""
    catalog_ids = [fp["id"] for fp in FINGERPRINT_CATALOG]
    expected = ["FP-001", "FP-002", "FP-003", "FP-004", "FP-005"]
    for fp_id in expected:
        assert fp_id in catalog_ids, f"Missing fingerprint {fp_id}"
    print(f"✓ Catalog completeness check passed ({len(FINGERPRINT_CATALOG)} fingerprints)")


if __name__ == "__main__":
    print("\n=== Diagnosis Phase 1 Tests ===\n")
    test_fingerprint_oom_kill()
    test_fingerprint_crash_loop()
    test_fingerprint_image_pull()
    test_fingerprint_cpu_starvation()
    test_fingerprint_no_match()
    test_feature_extraction_oom_case()
    test_feature_extraction_cpu_case()
    test_catalog_completeness()
    print("\n=== ALL TESTS PASSED ===\n")
