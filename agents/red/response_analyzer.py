"""
Response Analyzer — classifies WHY an attack failed.
Feeds structured context to the mutation engine.
"""
import re
from dataclasses import dataclass, field
from typing import Optional
import hashlib


@dataclass
class AttackResponse:
    status_code:    int
    body:           str
    elapsed_ms:     float
    defense_type:   str        # "waf_signature" | "input_validation" |
                               # "logic_block" | "partial_exec" | "success" | "network_err"
    is_new_path:    bool       # True if fingerprint not seen before
    fingerprint:    str        # hash of (status, length_bucket, error_type, timing_bucket)
    error_hint:     str        # specific error text if any
    partial_exec:   bool       # 500 = server processed something → interesting


WAF_PATTERNS     = re.compile(r"blocked|forbidden|waf|firewall|denied|filtered", re.I)
SQL_ERR_PATTERNS = re.compile(r"sql|syntax|query|column|table|operator", re.I)
PATH_ERR_PATTERNS= re.compile(r"not found|permission|access denied|no such file", re.I)
JWT_ERR_PATTERNS = re.compile(r"invalid|signature|algorithm|token|unauthorized", re.I)


def analyze(response, action_type: str) -> AttackResponse:
    """Parse an HTTP response into structured attack feedback."""
    body       = response.text if hasattr(response, 'text') else str(response)
    status     = response.status_code if hasattr(response, 'status_code') else 0
    elapsed_ms = (response.elapsed.total_seconds() * 1000
                  if hasattr(response, 'elapsed') else 0)

    # Determine defense type
    if status == 0:
        defense_type = "network_err"
    elif status == 200 and ("FLAG{" in body):
        defense_type = "success"
    elif status == 200 and "FLAG{" not in body:
        defense_type = "logic_block"   # got through but flag wasn't returned
    elif status == 403 and WAF_PATTERNS.search(body):
        defense_type = "waf_signature"
    elif status in (400, 422) and SQL_ERR_PATTERNS.search(body):
        defense_type = "input_validation"
    elif status == 500:
        defense_type = "partial_exec"   # server crashed on our input — very interesting
    elif status == 401 or status == 403:
        defense_type = "auth_block"
    else:
        defense_type = "unknown"

    # Error hint extraction
    error_hint = ""
    for pattern, name in [
        (SQL_ERR_PATTERNS,  "sql_error"),
        (JWT_ERR_PATTERNS,  "jwt_error"),
        (PATH_ERR_PATTERNS, "path_error"),
        (WAF_PATTERNS,      "waf_block"),
    ]:
        m = pattern.search(body)
        if m:
            # Grab surrounding context (safe excerpt — no copyright concern)
            start = max(0, m.start() - 20)
            end   = min(len(body), m.end() + 40)
            error_hint = body[start:end].strip()
            break

    # Fingerprint for coverage tracking
    length_bucket  = len(body) // 200
    timing_bucket  = int(elapsed_ms) // 500
    fp_str = f"{status}|{length_bucket}|{defense_type}|{timing_bucket}"
    fingerprint = hashlib.md5(fp_str.encode()).hexdigest()[:8]

    return AttackResponse(
        status_code=status, body=body[:500], elapsed_ms=elapsed_ms,
        defense_type=defense_type, is_new_path=False,  # set by CoverageTracker
        fingerprint=fingerprint, error_hint=error_hint,
        partial_exec=(status == 500)
    )


def analyze_error(exception: Exception) -> AttackResponse:
    fp = hashlib.md5(b"network_err").hexdigest()[:8]
    return AttackResponse(
        status_code=0, body=str(exception), elapsed_ms=0,
        defense_type="network_err", is_new_path=False,
        fingerprint=fp, error_hint=str(exception), partial_exec=False
    )