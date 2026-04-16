"""
Tests for LLM fallback diagnosis layer.
"""

import sys
import json
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from diagnosis.llm_fallback import (
    call_llm_api,
    _parse_llm_response,
    should_use_llm_fallback,
)


def test_llm_api_success_valid_json():
    """Test successful LLM API call with valid JSON response."""
    snapshot = {
        "metrics": {"memory_pct": 95.0, "cpu_pct": 40.0, "restart_count": 1},
        "events": ["OOMKilled event detected"],
        "logs_summary": ["killed due to out of memory"],
    }
    
    mock_response = Mock()
    mock_response.json.return_value = {
        "message": json.dumps({
            "root_cause": "Memory exhaustion due to memory leak",
            "confidence": 0.87,
            "reasoning": "OOM event plus 95% memory usage indicates leak",
            "suggested_actions": ["increase memory limit", "restart pod"],
        })
    }
    mock_response.raise_for_status = Mock()
    
    with patch("diagnosis.llm_fallback.requests.post", return_value=mock_response):
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat")
    
    assert result is not None
    assert result["root_cause"] == "Memory exhaustion due to memory leak"
    assert result["confidence"] == 0.87
    assert result["source"] == "llm_fallback"


def test_llm_api_success_markdown_json():
    """Test successful LLM API call with JSON wrapped in markdown."""
    snapshot = {
        "metrics": {"memory_pct": 88.0, "cpu_pct": 85.0, "restart_count": 3},
        "events": ["CrashLoopBackOff event"],
        "logs_summary": ["application crashed"],
    }
    
    mock_response = Mock()
    # Simulate LLM response with markdown-wrapped JSON
    mock_response.json.return_value = {
        "message": """Here's my analysis:
```json
{
    "root_cause": "Application bug causing repeated crashes",
    "confidence": 0.82,
    "reasoning": "CrashLoop + restart burst pattern",
    "suggested_actions": ["rollback deployment"]
}
```
"""
    }
    mock_response.raise_for_status = Mock()
    
    with patch("diagnosis.llm_fallback.requests.post", return_value=mock_response):
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat")
    
    assert result is not None
    assert result["root_cause"] == "Application bug causing repeated crashes"
    assert result["confidence"] == 0.82


def test_llm_api_timeout():
    """Test LLM API timeout falls back gracefully."""
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    with patch("diagnosis.llm_fallback.requests.post") as mock_post:
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("API timeout")
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat", timeout_seconds=5)
    
    assert result is None, "Should return None on timeout"


def test_llm_api_connection_error():
    """Test LLM API connection error falls back gracefully."""
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    with patch("diagnosis.llm_fallback.requests.post") as mock_post:
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection failed")
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat")
    
    assert result is None, "Should return None on connection error"


def test_llm_api_invalid_json_response():
    """Test LLM API with unparseable response falls back gracefully."""
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    mock_response = Mock()
    mock_response.json.return_value = {"message": "This is not JSON"}
    mock_response.raise_for_status = Mock()
    
    with patch("diagnosis.llm_fallback.requests.post", return_value=mock_response):
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat")
    
    assert result is None, "Should return None on parse failure"


def test_llm_api_missing_required_fields():
    """Test LLM API response missing required fields falls back gracefully."""
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    mock_response = Mock()
    mock_response.json.return_value = {
        "message": json.dumps({
            "root_cause": "Some error",
            # Missing "confidence" field
        })
    }
    mock_response.raise_for_status = Mock()
    
    with patch("diagnosis.llm_fallback.requests.post", return_value=mock_response):
        result = call_llm_api(snapshot, api_url="https://example.local/api/chat")
    
    assert result is None, "Should return None if required fields missing"


def test_parse_llm_response_valid():
    """Test parsing valid LLM response."""
    response_data = {
        "message": json.dumps({
            "root_cause": "Database connection pool exhausted",
            "confidence": 0.91,
            "reasoning": "High latency + connection timeout logs",
            "suggested_actions": ["increase DB_POOL_SIZE"],
        })
    }
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    result = _parse_llm_response(response_data, snapshot)
    
    assert result["root_cause"] == "Database connection pool exhausted"
    assert result["confidence"] == 0.91
    assert result["source"] == "llm_fallback"


def test_parse_llm_response_confidence_clamping():
    """Test confidence value clamping to valid range."""
    response_data = {
        "message": json.dumps({
            "root_cause": "Some error",
            "confidence": 1.5,  # Invalid: > 1.0
        })
    }
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    result = _parse_llm_response(response_data, snapshot)
    
    assert result["confidence"] == 1.0, "Confidence should be clamped to 1.0"


def test_parse_llm_response_missing_root_cause():
    """Test parsing response with missing root_cause raises error."""
    response_data = {
        "message": json.dumps({
            "confidence": 0.8,
            # Missing "root_cause"
        })
    }
    snapshot = {"metrics": {}, "events": [], "logs_summary": []}
    
    with pytest.raises(ValueError) as exc_info:
        _parse_llm_response(response_data, snapshot)
    assert "root_cause" in str(exc_info.value)


def test_should_use_llm_fallback_low_confidence():
    """Test LLM fallback triggered for low rule confidence."""
    # Rule confidence 0.5 < threshold (0.75) AND budget allows
    assert should_use_llm_fallback(0.5, True)


def test_should_use_llm_fallback_high_confidence():
    """Test LLM fallback NOT triggered for high rule confidence."""
    # Rule confidence 0.9 >= threshold (0.75)
    assert not should_use_llm_fallback(0.9, True)
    assert not should_use_llm_fallback(0.9, False)


def test_should_use_llm_fallback_no_budget():
    """Test LLM fallback NOT triggered when budget exhausted."""
    # Rule confidence 0.5 < threshold BUT budget_allows=False
    assert not should_use_llm_fallback(0.5, False)
