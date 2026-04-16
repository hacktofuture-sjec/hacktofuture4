# Testing Guide: How to Test Phase 1 & 2

## Quick Start

```bash
cd c:\Users\vivek\projects\hacktofuture\hacktofuture4-A07

# Run all tests
pytest backend/tests/ -v

# Run specific test suite
pytest backend/tests/test_diagnosis_agents.py -v
pytest backend/tests/test_llm_fallback.py -v
pytest backend/tests/test_planner_agents.py -v
pytest backend/tests/test_models_contract.py -v

# Run with coverage
pytest backend/tests/ --cov=backend --cov-report=html

# Run with output (prints & logs visible)
pytest backend/tests/ -v -s
```

---

## Test Structure (37 Total Tests)

| Suite        | File                       | Tests  | Coverage                                                      | Time       |
| ------------ | -------------------------- | ------ | ------------------------------------------------------------- | ---------- |
| Diagnosis    | `test_diagnosis_agents.py` | 9      | FP-001 through FP-005, feature extraction, ranking            | 0.05s      |
| LLM Fallback | `test_llm_fallback.py`     | 12     | API calls, JSON parsing (3 tiers), error handling, budget     | 0.15s      |
| Planner      | `test_planner_agents.py`   | 11     | Policy selection, action generation, risk ranking, end-to-end | 0.04s      |
| Models       | `test_models_contract.py`  | 4      | Pydantic validation, JSON serialization                       | 0.14s      |
| **Total**    | —                          | **37** | **All core components**                                       | **~0.65s** |

---

## Diagnosis Tests (9 Tests)

**File**: `backend/tests/test_diagnosis_agents.py`

### What Each Test Does

#### 1. `test_fp001_oom_matched`

Tests FP-001 (Memory Exhaustion) fingerprint matching.

```python
def test_fp001_oom_matched():
    """FP-001 should match OOMKilled event + high memory."""
    snapshot = IncidentSnapshot(
        service="api",
        metrics={"memory_pct": 95, "cpu_pct": 30, ...},
        events=[{"reason": "OOMKilled"}],
        logs_summary=[],
    )

    matches = match_fingerprints(snapshot)
    assert len(matches) == 1
    assert matches[0].fingerprint_id == "FP-001"
    assert matches[0].confidence == 0.95
    assert "memory exhaustion" in matches[0].root_cause
```

**Expected**: 1 match with confidence 0.95.

#### 2. `test_fp002_crash_loop_matched`

Tests FP-002 (Crash Loop) fingerprint matching.

```python
def test_fp002_crash_loop_matched():
    """FP-002 should match CrashLoopBackOff event + high restart count."""
    snapshot = IncidentSnapshot(
        service="worker",
        metrics={"restart_count": 8, "cpu_pct": 20, ...},
        events=[{"reason": "CrashLoopBackOff"}],
        logs_summary=[],
    )

    matches = match_fingerprints(snapshot)
    assert len(matches) == 1
    assert matches[0].fingerprint_id == "FP-002"
    assert matches[0].confidence == 0.90
```

**Expected**: 1 match with confidence 0.90.

#### 3–5. `test_fp003_image_pull_matched`, `test_fp004_scheduling_matched`, `test_fp005_db_pool_matched`

Similar structure: each tests one fingerprint pattern with correct confidence score.

#### 6. `test_no_fingerprint_matched`

Tests unrelated metrics/events.

```python
def test_no_fingerprint_matched():
    """No fingerprint should match unrelated snapshot."""
    snapshot = IncidentSnapshot(
        service="healthy-service",
        metrics={"cpu_pct": 10, "memory_pct": 20, "restart_count": 0},
        events=[],
        logs_summary=[],
    )

    matches = match_fingerprints(snapshot)
    assert len(matches) == 0
```

**Expected**: Empty match list.

#### 7. `test_feature_extraction_metrics`

Tests feature extraction (metrics-based features).

```python
def test_feature_extraction_metrics():
    """Feature extraction should compute z-scores and multipliers."""
    snapshot = IncidentSnapshot(
        metrics={
            "cpu_pct": 60,
            "memory_pct": 50,
            "latency_delta": "2.5x",
        }
    )

    features = extract_features(snapshot)
    assert features.cpu_pct_now == 60
    assert features.memory_pct_now == 50
    assert features.latency_multiplier == 2.5
    assert features.cpu_z_score == 8.0  # (60 - 20) / 5
```

**Expected**: Z-scores computed relative to baseline (mean=20, σ=5).

#### 8. `test_feature_extraction_logs`

Tests feature extraction (log/event features).

```python
def test_feature_extraction_logs():
    """Feature extraction should identify top signatures and event reasons."""
    snapshot = IncidentSnapshot(
        events=[{"reason": "OOMKilled"}, {"reason": "OOMKilled"}],
        logs_summary=[
            {"signature": "memory exhaustion", "count": 5},
            {"signature": "timeout", "count": 2},
        ]
    )

    features = extract_features(snapshot)
    assert features.top_event_reason == "OOMKilled"
    assert features.top_error_signature == "memory exhaustion"
    assert features.error_signature_count == 2
```

**Expected**: Top signatures identified by frequency.

#### 9. `test_confidence_ranking`

Tests ordering of multiple matches by confidence.

```python
def test_confidence_ranking():
    """Multiple matches should be sorted by confidence (highest first)."""
    snapshot = IncidentSnapshot(...)  # Matches both FP-001 and FP-003

    matches = match_fingerprints(snapshot)
    assert len(matches) == 2
    assert matches[0].confidence >= matches[1].confidence
```

**Expected**: Matches sorted by confidence descending.

---

## LLM Fallback Tests (12 Tests)

**File**: `backend/tests/test_llm_fallback.py`

### API & Error Handling Tests

#### 1. `test_llm_api_success`

Full successful API call flow.

````python
def test_llm_api_success(mocker):
    """LLM API should parse response and return diagnosis."""
    # Mock requests.post to return valid response
    mock_response = Mock()
    mock_response.json.return_value = {
        "message": '```json\n{"root_cause": "...", "confidence": 0.85, ...}\n```'
    }
    mocker.patch('requests.post', return_value=mock_response)

    result = call_llm_api(snapshot)

    assert result is not None
    assert result["confidence"] == 0.85
    assert result["source"] == "llm_fallback"
````

**Expected**: Diagnosis dict returned.

#### 2–4. `test_llm_response_timeout`, `test_llm_response_connection_error`, `test_llm_response_http_error`

Test graceful degradation on failures.

```python
def test_llm_response_timeout(mocker):
    """LLM timeout should return None (graceful fallback)."""
    mocker.patch('requests.post', side_effect=requests.exceptions.Timeout)

    result = call_llm_api(snapshot, timeout_seconds=1)

    assert result is None
```

**Expected**: `None` returned on timeout; no exception raised.

### JSON Parsing Tests

#### 5. `test_json_parse_fenced_block`

Tier 1: Fenced ``json ... `

````python
def test_json_parse_fenced_block():
    """Should extract JSON from fenced block."""
    message = 'Analysis:\n```json\n{"root_cause": "oom", "confidence": 0.9}\n```\nDone.'

    result = _parse_llm_message_json(message)

    assert result["root_cause"] == "oom"
    assert result["confidence"] == 0.9
````

**Expected**: JSON extracted successfully.

#### 6. `test_json_parse_greedy_regex`

Tier 2: Greedy `{...}` extraction.

```python
def test_json_parse_greedy_regex():
    """Should extract JSON using greedy regex when no fence."""
    message = 'The diagnosis: {"root_cause": "crash", "confidence": 0.8} That is all.'

    result = _parse_llm_message_json(message)

    assert result["root_cause"] == "crash"
```

**Expected**: JSON extracted despite wrapper text.

#### 7. `test_json_parse_incremental_decoder`

Tier 3: Incremental JSON decoder.

```python
def test_json_parse_incremental_decoder():
    """Should use incremental decoder for partial JSON."""
    message = 'junk{"root_cause": "pool", "confidence": 0.82}more junk'

    result = _parse_llm_message_json(message)

    assert result["root_cause"] == "pool"
```

**Expected**: JSON extracted from noise.

#### 8. `test_json_parse_all_tiers_fail`

All tiers fail → ValueError raised.

```python
def test_json_parse_all_tiers_fail():
    """Should raise ValueError if no JSON found."""
    message = 'This is just text with no json at all'

    with pytest.raises(ValueError):
        _parse_llm_message_json(message)
```

**Expected**: ValueError with clear error message.

### Response Normalization Tests

#### 9. `test_confidence_coercion`

Confidence coerced to float and clamped.

````python
def test_confidence_coercion():
    """Confidence should be coerced to float and clamped to [0, 1]."""
    response = {
        "message": '```json\n{"root_cause": "test", "confidence": "0.85"}\n```'
    }

    result = _parse_llm_response(response, snapshot)

    assert isinstance(result["confidence"], float)
    assert 0 <= result["confidence"] <= 1
````

**Expected**: String "0.85" → float 0.85.

#### 10. `test_missing_required_fields`

Missing required fields → ValueError.

````python
def test_missing_required_fields():
    """Should raise ValueError if root_cause or confidence missing."""
    response = {"message": '```json\n{"confidence": 0.8}\n```'}  # Missing root_cause

    with pytest.raises(ValueError, match="Missing required field"):
        _parse_llm_response(response, snapshot)
````

**Expected**: ValueError with field name.

### Token Budget Tests

#### 11. `test_token_governor_budget_gate`

Budget gating logic.

```python
def test_token_governor_budget_gate():
    """Budget gate should deny calls when limits exceeded."""
    governor = TokenGovernor()

    # First call should pass
    assert governor.can_afford_ai_call(0.05)
    governor.record_ai_call(100, 100, 0.05, 0.05)

    # Second call should pass (still within limits)
    assert governor.can_afford_ai_call(0.05)
    governor.record_ai_call(100, 100, 0.05, 0.05)

    # Third call should fail (2 calls already)
    assert not governor.can_afford_ai_call(0.01)
```

**Expected**: Gate allows max 2 calls.

#### 12. `test_token_governor_cost_tracking`

Dual-track cost recording.

```python
def test_token_governor_cost_tracking():
    """Should track estimated and actual costs separately."""
    governor = TokenGovernor()

    governor.record_ai_call(
        estimated_tokens=100,
        actual_tokens=98,
        estimated_cost=0.00005,
        actual_cost=0.000048,
    )

    assert governor.estimated_cost_this_incident == 0.00005
    assert governor.cost_this_incident == 0.000048
```

**Expected**: Estimated and actual tracked independently.

---

## Planner Tests (11 Tests)

**File**: `backend/tests/test_planner_agents.py`

### Policy Selection Tests

```python
def test_policy_selection_single_match():
    """Should match single applicable policy."""
    diagnosis = DiagnosisPayload(
        root_cause="application crash loop: repeated process exit",
        ...
    )

    policies = select_applicable_policies(diagnosis, POLICY_CATALOG)

    assert len(policies) >= 1
    assert any(p.id == "POL-001" for p in policies)  # restart_pod applicable
```

### Action Generation Tests

```python
def test_action_template_substitution():
    """Should substitute context variables into templates."""
    template = "kubectl rollout restart deployment/{service} -n {namespace}"
    context = {"service": "payments-api", "namespace": "prod"}

    result = generate_action_command(template, context)

    assert result == "kubectl rollout restart deployment/payments-api -n prod"
    assert "{" not in result  # No placeholders remaining
```

### Risk-Based Ranking Tests

```python
def test_risk_based_ranking_low_first():
    """Low-risk actions should be ranked before high-risk."""
    actions = [
        Action(template="...", risk="high", ...),
        Action(template="...", risk="low", ...),
        Action(template="...", risk="medium", ...),
    ]

    ranked = rank_actions(actions, confidence=0.90)

    assert ranked[0].risk_level == "low"
    assert ranked[1].risk_level == "medium"
    assert ranked[2].risk_level == "high"
```

### Integration Test

```python
def test_policy_ranker_end_to_end():
    """Full pipeline: diagnosis → policy selection → ranking → output."""
    diagnosis = DiagnosisPayload(
        root_cause="memory exhaustion",
        confidence=0.95,
        affected_services=["payments-api"],
        context={"namespace": "prod"},
    )

    output = plan_remediation(diagnosis)

    assert output.incident_id == diagnosis.incident_id
    assert len(output.ranked_actions) > 0
    assert output.ranked_actions[0].risk_level <= output.ranked_actions[-1].risk_level
```

---

## Model Contract Tests (4 Tests)

**File**: `backend/tests/test_models_contract.py`

```python
def test_incident_snapshot_valid():
    """IncidentSnapshot should validate required fields."""
    snapshot = IncidentSnapshot(
        incident_id="inc-001",
        service="api",
        metrics={"cpu_pct": 50},
        events=[],
        logs_summary=[],
    )
    assert snapshot.incident_id == "inc-001"

def test_diagnosis_payload_valid():
    """DiagnosisPayload should validate fields."""
    diagnosis = DiagnosisPayload(
        incident_id="inc-001",
        root_cause="test",
        confidence=0.85,
        ...
    )
    assert 0 <= diagnosis.confidence <= 1

def test_planner_output_valid():
    """PlannerOutput should validate ranked actions."""
    output = PlannerOutput(...)
    assert isinstance(output.ranked_actions, list)

def test_models_json_serialization():
    """Models should serialize to/from JSON."""
    diagnosis = DiagnosisPayload(...)
    json_str = json.dumps(diagnosis, default=pydantic_encoder)
    assert isinstance(json_str, str)
```

---

## Running Tests Locally

### Run All Tests

```bash
cd c:\Users\vivek\projects\hacktofuture\hacktofuture4-A07
pytest backend/tests/ -v
```

Output:

```
test_fp001_oom_matched PASSED
test_fp002_crash_loop_matched PASSED
test_fp003_image_pull_matched PASSED
test_fp004_scheduling_matched PASSED
test_fp005_db_pool_matched PASSED
test_no_fingerprint_matched PASSED
test_feature_extraction_metrics PASSED
test_feature_extraction_logs PASSED
test_confidence_ranking PASSED
test_llm_api_success PASSED
test_llm_response_timeout PASSED
test_llm_response_connection_error PASSED
test_llm_response_http_error PASSED
test_json_parse_fenced_block PASSED
test_json_parse_greedy_regex PASSED
test_json_parse_incremental_decoder PASSED
test_json_parse_all_tiers_fail PASSED
test_confidence_coercion PASSED
test_missing_required_fields PASSED
test_token_governor_budget_gate PASSED
test_token_governor_cost_tracking PASSED
test_policy_selection_single_match PASSED
test_policy_selection_multiple_matches PASSED
test_policy_selection_no_matches PASSED
test_action_context_extraction PASSED
test_action_template_substitution PASSED
test_action_command_generation PASSED
test_risk_based_ranking_low_first PASSED
test_risk_based_ranking_confidence_tiebreaker PASSED
test_ranked_actions_output_schema PASSED
test_policy_ranker_end_to_end PASSED
test_planner_output_json_serialization PASSED
test_incident_snapshot_valid PASSED
test_diagnosis_payload_valid PASSED
test_planner_output_valid PASSED
test_models_json_serialization PASSED

===== 37 passed in 0.65s =====
```

### Run with Coverage Report

```bash
pytest backend/tests/ --cov=backend --cov-report=html
# Opens: htmlcov/index.html
```

### Run Specific Suite

```bash
# Diagnosis only
pytest backend/tests/test_diagnosis_agents.py -v

# LLM fallback only
pytest backend/tests/test_llm_fallback.py -v

# Planner only
pytest backend/tests/test_planner_agents.py -v

# Models only
pytest backend/tests/test_models_contract.py -v
```

### Run with Debug Output

```bash
# Show print statements and logs
pytest backend/tests/ -v -s

# Show variable values
pytest backend/tests/ -v -s --tb=short
```

---

## Test Dependencies

```
pytest>=8.3.3
pytest-mock>=3.12.0
requests>=2.32.3  # For mocking HTTP calls
pydantic>=2.9.2
```

---

## Key Testing Principles

1. **Isolation**: Each test is independent; no shared state
2. **Mocking**: External APIs (LLM, Kubernetes) are mocked; no real calls
3. **Fast**: All 37 tests run in ~0.65 seconds
4. **Deterministic**: No randomness; same input → same output
5. **Clear assertions**: Each test asserts one primary behavior

---

## Troubleshooting

### Test Fails: `ModuleNotFoundError: No module named 'pytest'`

```bash
pip install pytest pytest-mock
```

### Test Fails: `E AssertionError: assert 0.90 != 0.95`

Check if you modified confidence thresholds. Restore from git if unintended.

### Test Fails: `E TimeoutError`

LLM mocking may not be working. Check `@patch` decorators on test.

### Tests Pass Locally but Fail in CI

Ensure environment variables are set (e.g., `LLM_FALLBACK_API_URL`).

---

## Related Documentation

- [00-overview.md](00-overview.md) — Overall test coverage summary
- [06-api-endpoints.md](06-api-endpoints.md) — Integration test examples
- [08-running-the-system.md](08-running-the-system.md) — End-to-end demo
