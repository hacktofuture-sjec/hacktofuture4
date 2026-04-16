"""
Log Feature Extractor — Domain-Specific 12-dim Feature Vector

Previous version (BROKEN) injected hardcoded probability spikes like
  vec[24] = 0.8   # forces "serror_rate" spike into NSL-KDD slot
before XGBoost ran — turning ML classification into regex detection
wearing an AI costume.

This version:
  1. Extracts 12 genuine numerical features from the real Docker log schema.
  2. Treats attack-pattern signals as plain binary (0/1) features —
     XGBoost learns THEIR WEIGHT from training data, not from us.
  3. Adds a detection_prob parameter to batch_extract() so Blue doesn't
     get perfect instant detection (realistic log sampling / buffering).
"""
import json, re
import numpy as np

FEATURE_DIM = 12

# ── Service IDs ───────────────────────────────────────────────────────────────
SERVICE_IDS = {
    "flask-sqli":         0,
    "node-pathtraversal": 1,
    "jwt-auth":           2,
    "nginx-misconfig":    3,
    "postgres-weak":      4,
    "redis-noauth":       5,
}
_N_SERVICES = len(SERVICE_IDS)  # used for normalization

# ── Compiled attack-signal patterns ──────────────────────────────────────────
# These are RAW binary signals — they do NOT set high-probability floats.
# The XGBoost model learns the correct weight from domain training data.
_RE_SQLI = re.compile(
    r"(union\s+select|or\s+1\s*=\s*1|'\s*or\b|';\s*select|"
    r"select\s+\w+\s+from|insert\s+into|drop\s+table|"
    r"pg_shadow|information_schema|sleep\s*\()",
    re.I
)
_RE_PATH_TRAV = re.compile(
    r"(\.\./|\.\.%2f|%252e%252e|%2e%2e%2f|\.\.\\\\)",
    re.I
)
_RE_JWT_NONE = re.compile(
    r"(\"alg\"\s*:\s*\"[Nn]one\"|alg.*?none)",
    re.I
)
_RE_SENSITIVE = re.compile(
    r"(/admin|/secret|/flag|/root|pg_hba|/shadow|/etc/passwd)",
    re.I
)
_RE_BRUTE = re.compile(
    r"(authentication fail|invalid password|wrong password|"
    r"FATAL.*password|login attempt|access denied)",
    re.I
)


def extract(log_line: str, service_name: str) -> "np.ndarray | None":
    """
    Parse a single Docker log line → 12-dim feature vector.

    Feature layout:
      0  service_id          — which service (normalized 0–1)
      1  method_id           — HTTP verb (GET=0, POST=0.5, other=1.0)
      2  path_depth          — URL path depth (normalized, cap 8)
      3  args_count          — number of query params (normalized, cap 10)
      4  args_length         — total args string length (normalized, cap 500)
      5  has_sqli            — SQLi pattern present (binary)
      6  has_path_traversal  — path traversal pattern present (binary)
      7  has_jwt_none        — JWT none-alg pattern present (binary)
      8  is_sensitive_path   — admin/secret/flag path accessed (binary)
      9  request_size        — total log record size (normalized, cap 2000)
     10  failed_login_rate   — failed login signal (normalized, cap 10)
     11  is_health_check     — health endpoint (always normal, binary)

    Returns None if line is empty or cannot be parsed.
    """
    if not log_line.strip():
        return None

    vec = np.zeros(FEATURE_DIM, dtype=np.float32)

    try:
        rec = json.loads(log_line)
    except json.JSONDecodeError:
        rec = {"raw": log_line}

    raw_str = json.dumps(rec)
    path     = str(rec.get("path", rec.get("url", "/")))
    args     = rec.get("args", rec.get("params", {}))
    args_str = json.dumps(args) if isinstance(args, (dict, list)) else str(args)
    method   = str(rec.get("method", "GET")).upper()

    # 0 — Service identity (0–1 normalized)
    vec[0] = SERVICE_IDS.get(service_name, 0) / max(_N_SERVICES - 1, 1)

    # 1 — HTTP method (GET=0.0, POST=0.5, other variants in between)
    vec[1] = {"GET": 0.0, "POST": 0.5, "PUT": 0.75, "DELETE": 1.0}.get(method, 0.25)

    # 2 — URL path depth (number of "/" segments, normalized, cap at 8)
    vec[2] = min(path.count("/"), 8) / 8.0

    # 3 — Number of query parameters (normalized, cap at 10)
    n_args = len(args) if isinstance(args, dict) else (1 if args_str.strip() else 0)
    vec[3] = min(n_args, 10) / 10.0

    # 4 — Total query string length (normalized, cap at 500 chars)
    vec[4] = min(len(args_str), 500) / 500.0

    # 5 — SQLi signal (binary: 0 or 1)
    vec[5] = 1.0 if _RE_SQLI.search(raw_str) else 0.0

    # 6 — Path traversal signal (binary: 0 or 1)
    vec[6] = 1.0 if _RE_PATH_TRAV.search(raw_str) else 0.0

    # 7 — JWT none-algorithm signal (binary: 0 or 1)
    vec[7] = 1.0 if _RE_JWT_NONE.search(raw_str) else 0.0

    # 8 — Sensitive path accessed (admin/secret/flag/root) (binary)
    vec[8] = 1.0 if _RE_SENSITIVE.search(raw_str) else 0.0

    # 9 — Total request record size (normalized, cap at 2000 chars)
    vec[9] = min(len(raw_str), 2000) / 2000.0

    # 10 — Failed login / brute-force signal (normalized, cap at 10 events)
    failed = float(rec.get("num_failed_logins", 0))
    if failed == 0.0 and _RE_BRUTE.search(raw_str):
        failed = 1.0
    vec[10] = min(failed, 10.0) / 10.0

    # 11 — Health-check endpoint (always normal traffic, binary)
    vec[11] = 1.0 if path.strip("/").endswith("health") else 0.0

    return vec


def extract_src_ip(log_line: str) -> str:
    """Pull the source IP from a JSON log line."""
    try:
        rec = json.loads(log_line)
        return rec.get("ip", rec.get("src_ip", rec.get("remote_addr", "unknown")))
    except Exception:
        return "unknown"


def batch_extract(log_lines: list, service_name: str,
                  detection_prob: float = 1.0) -> list:
    """
    Convert a list of raw log lines → list of (feature_vec, src_ip) tuples.

    detection_prob (0–1): probability of processing each log line.
      - 1.0 = perfect detection (old behaviour, unrealistic)
      - 0.7 = realistic — Blue misses ~30% of lines due to buffering,
              log rotation, delayed delivery etc.

    Only lines that pass the probabilistic gate AND parse successfully
    are returned. This prevents Blue from having artificially perfect
    knowledge of every single attack payload the moment it lands.
    """
    import random
    results = []
    for line in log_lines:
        if not line.strip():
            continue
        # Probabilistic gate — simulates realistic log sampling
        if detection_prob < 1.0 and random.random() > detection_prob:
            continue
        vec = extract(line, service_name)
        if vec is not None:
            ip = extract_src_ip(line)
            results.append((vec, ip))
    return results