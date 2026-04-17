import hashlib
import hmac
import json
import os
import secrets
import uuid
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import jwt
import pyotp
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from sentence_transformers import SentenceTransformer, util  # type: ignore
except Exception:
    SentenceTransformer = None  # type: ignore
    util = None  # type: ignore

app = FastAPI(title="Aegis-DID Analytics Engine")

# Setup audit log
AUDIT_LOG_DIR = Path(os.getenv('AUDIT_LOG_DIR', '/var/log/aegis'))
AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_LOG_FILE = AUDIT_LOG_DIR / 'enforcement-decisions.jsonl'
USERS_FILE = Path(os.getenv('AUTH_USERS_FILE', '/var/lib/aegis/users.json'))
USERS_FILE.parent.mkdir(parents=True, exist_ok=True)

JWT_SECRET = os.getenv('JWT_SECRET') or secrets.token_urlsafe(48)
JWT_ALGORITHM = 'HS256'
DEFAULT_ACCESS_TTL_SECONDS = int(os.getenv('ACCESS_TOKEN_TTL_SECONDS', '300'))
STEP_UP_TTL_SECONDS = int(os.getenv('STEP_UP_TTL_SECONDS', '60'))

def log_decision_to_file(decision_data: dict) -> None:
    """Append decision to audit log as JSONL"""
    try:
        import json
        with open(AUDIT_LOG_FILE, 'a') as f:
            f.write(json.dumps(decision_data) + '\n')
    except Exception as e:
        print(f'Error writing to audit log: {e}')


def _load_users() -> Dict[str, Dict[str, str]]:
    if not USERS_FILE.exists():
        return {}
    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_users(users: Dict[str, Dict[str, str]]) -> None:
    tmp_file = USERS_FILE.with_suffix('.tmp')
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)
    tmp_file.replace(USERS_FILE)


def _hash_password(password: str, salt: bytes) -> str:
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 120_000)
    return dk.hex()


def _create_user(username: str, password: str) -> Dict[str, str]:
    users = _load_users()
    if username in users:
        raise HTTPException(status_code=409, detail='User already exists')
    salt = secrets.token_bytes(16)
    totp_secret = pyotp.random_base32()
    users[username] = {
        'salt': salt.hex(),
        'password_hash': _hash_password(password, salt),
        'totp_secret': totp_secret,
    }
    _save_users(users)
    return {'username': username, 'totp_secret': totp_secret}


def _verify_password(username: str, password: str) -> bool:
    users = _load_users()
    user = users.get(username)
    if not user:
        return False
    salt = bytes.fromhex(user['salt'])
    expected = user['password_hash']
    candidate = _hash_password(password, salt)
    return hmac.compare_digest(candidate, expected)


def _verify_totp(username: str, otp_code: str) -> bool:
    users = _load_users()
    user = users.get(username)
    if not user:
        return False
    return pyotp.TOTP(user['totp_secret']).verify(otp_code, valid_window=1)


def _issue_jwt_token(subject: str, ttl_seconds: int, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        'sub': subject,
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        'jti': secrets.token_urlsafe(12),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail='Invalid or expired token') from exc


def _require_bearer_token(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail='Missing Authorization header')
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Invalid Authorization header format')
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail='Missing bearer token')
    return _decode_token(token)


def _require_authenticated_user(authorization: Optional[str]) -> str:
    payload = _require_bearer_token(authorization)
    if payload.get('purpose') == 'step_up':
        raise HTTPException(status_code=401, detail='Step-up token cannot be used as session token')
    username = payload.get('sub')
    if not username:
        raise HTTPException(status_code=401, detail='Invalid token subject')
    return str(username)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_state = {"trust_score": 1.0, "intent_drift_detected": False}

# Real incident state — backend-owned
incidents_state = {
    "active_incident": None,
    "enforcement_decisions": []
}

# Prefer semantic model when available, otherwise use deterministic token similarity.
model = None
model_load_error = None
if SentenceTransformer is not None:
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as exc:
        model_load_error = str(exc)


def _tokenize(value: str) -> set[str]:
    return set(re.findall(r'[a-z0-9]+', value.lower()))


def _fallback_similarity(a: str, b: str) -> float:
    ta = _tokenize(a)
    tb = _tokenize(b)
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    inter = len(ta.intersection(tb))
    union = len(ta.union(tb))
    return inter / union if union else 0.0

class TrustRequest(BaseModel):
    assigned_intent: str
    current_action: str

class TrustResponse(BaseModel):
    trust_score: float
    intent_drift_detected: bool

class IncidentRequest(BaseModel):
    id: str
    detected_at: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    description: str

class IncidentResponse(BaseModel):
    id: str
    detected_at: str
    severity: str
    description: str

class EnforcementDecision(BaseModel):
    decision: str  # ALLOW or DENY
    reason: Optional[str] = None
    authMethod: Optional[str] = None
    stepUpToken: Optional[str] = None
    timestamp: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=256)


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=256)
    otp: str = Field(min_length=6, max_length=8)


class StepUpRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=8)


@app.post('/auth/register')
def register(req: RegisterRequest):
    created = _create_user(req.username, req.password)
    otp_uri = pyotp.TOTP(created['totp_secret']).provisioning_uri(
        name=created['username'],
        issuer_name='AEGIS-DID',
    )
    return {
        'status': 'registered',
        'username': created['username'],
        'totp_secret': created['totp_secret'],
        'totp_uri': otp_uri,
    }


@app.post('/auth/login')
def login(req: LoginRequest):
    if not _verify_password(req.username, req.password):
        raise HTTPException(status_code=401, detail='Invalid username or password')
    if not _verify_totp(req.username, req.otp):
        raise HTTPException(status_code=401, detail='Invalid TOTP code')

    trust_multiplier = max(0.1, min(1.0, float(active_state['trust_score'])))
    ttl_seconds = max(30, int(DEFAULT_ACCESS_TTL_SECONDS * trust_multiplier))
    access_token = _issue_jwt_token(
        req.username,
        ttl_seconds=ttl_seconds,
        extra_claims={'trust_score': active_state['trust_score']},
    )
    return {
        'access_token': access_token,
        'token_type': 'bearer',
        'expires_in': ttl_seconds,
        'trust_score': active_state['trust_score'],
    }


@app.get('/auth/me')
def auth_me(authorization: Optional[str] = Header(default=None)):
    username = _require_authenticated_user(authorization)
    return {'username': username, 'authenticated': True}


@app.post('/auth/step-up')
def auth_step_up(req: StepUpRequest, authorization: Optional[str] = Header(default=None)):
    username = _require_authenticated_user(authorization)
    if not _verify_totp(username, req.otp):
        raise HTTPException(status_code=401, detail='Invalid TOTP code')
    step_up_token = _issue_jwt_token(
        username,
        ttl_seconds=STEP_UP_TTL_SECONDS,
        extra_claims={'purpose': 'step_up'},
    )
    return {'step_up_token': step_up_token, 'expires_in': STEP_UP_TTL_SECONDS}

@app.post("/calculate_trust", response_model=TrustResponse)
def calculate_trust(req: TrustRequest):
    if model is not None and util is not None:
        # Semantic similarity path.
        embeddings = model.encode([req.assigned_intent, req.current_action])
        score = util.cos_sim(embeddings[0], embeddings[1]).item()
    else:
        # Fast fallback path when sentence-transformers is unavailable.
        score = _fallback_similarity(req.assigned_intent, req.current_action)
    
    # Simple deterministic heuristic thresholding
    drift_detected = score < 0.5
    
    active_state["trust_score"] = float(score)
    active_state["intent_drift_detected"] = bool(drift_detected)
    
    return TrustResponse(
        trust_score=score,
        intent_drift_detected=drift_detected
    )

@app.get("/latest_score", response_model=TrustResponse)
def get_latest_score():
    return TrustResponse(
        trust_score=active_state["trust_score"],
        intent_drift_detected=active_state["intent_drift_detected"]
    )

@app.get("/health")
def health():
    return {
        "status": "operational",
        "model_loaded": model is not None,
        "model_fallback": model is None,
        "version": "2.5.0",
    }

@app.get("/model_info")
def model_info():
    if model is None:
        return {
            "model_name": "fallback-token-jaccard",
            "embedding_dimensions": 0,
            "task": "Token Similarity (Jaccard)",
            "framework": "Pure Python Fallback",
            "threshold": 0.5,
            "active_state": active_state,
            "model_load_error": model_load_error,
        }
    return {
        "model_name": "all-MiniLM-L6-v2",
        "embedding_dimensions": 384,
        "task": "Semantic Similarity (Cosine Distance)",
        "framework": "PyTorch + sentence-transformers",
        "threshold": 0.5,
        "active_state": active_state
    }

# Incident & Enforcement Endpoints
@app.post("/incidents/create")
def create_incident(req: IncidentRequest, authorization: Optional[str] = Header(default=None)):
    """Create a real backend-owned incident for HITL decision"""
    _require_authenticated_user(authorization)
    incidents_state["active_incident"] = {
        "id": req.id,
        "detected_at": req.detected_at,
        "severity": req.severity,
        "description": req.description,
    }
    return {"status": "incident_created", "incident_id": req.id}

@app.get("/incidents/active")
def get_active_incident():
    """Retrieve active incident for frontend HITL flow"""
    if incidents_state["active_incident"]:
        return incidents_state["active_incident"]
    return {"id": None}

@app.post("/enforce/decision")
def record_enforcement_decision(decision: EnforcementDecision, authorization: Optional[str] = Header(default=None)):
    """Record HITL enforcement decision from frontend"""
    username = _require_authenticated_user(authorization)

    decision_type = decision.decision.upper().strip()
    if decision_type not in {'ALLOW', 'DENY'}:
        raise HTTPException(status_code=400, detail='Decision must be ALLOW or DENY')

    if decision_type == 'ALLOW':
        if not decision.stepUpToken:
            raise HTTPException(status_code=403, detail='Step-up token is required for ALLOW')
        step_up_claims = _decode_token(decision.stepUpToken)
        if step_up_claims.get('purpose') != 'step_up':
            raise HTTPException(status_code=403, detail='Invalid step-up token')
        if step_up_claims.get('sub') != username:
            raise HTTPException(status_code=403, detail='Step-up token subject mismatch')

    decision_record = {
        "decision": decision_type,
        "reason": decision.reason,
        "authMethod": decision.authMethod,
        "operator": username,
        "timestamp": decision.timestamp,
        "recorded_at": datetime.utcnow().isoformat(),
    }
    incidents_state["enforcement_decisions"].append({
        "decision": decision_type,
        "reason": decision.reason,
        "authMethod": decision.authMethod,
        "operator": username,
        "timestamp": decision.timestamp,
    })
    log_decision_to_file(decision_record)
    # Clear active incident once decision is recorded
    incidents_state["active_incident"] = None
    return {"status": "decision_recorded", "decision": decision_type, "audit_id": decision_record["recorded_at"]}

@app.post("/enforce/reset")
def reset_enforcement(authorization: Optional[str] = Header(default=None)):
    """Reset all enforcement and incident state"""
    _require_authenticated_user(authorization)
    incidents_state["active_incident"] = None
    incidents_state["enforcement_decisions"] = []
    return {"status": "reset_complete"}

# Test & Debug Endpoints
@app.post("/test/trigger-incident")
def test_trigger_incident(severity: str = "HIGH", authorization: Optional[str] = Header(default=None)):
    """Manual test endpoint: trigger an incident for HITL testing"""
    _require_authenticated_user(authorization)
    test_incident = {
        "id": str(uuid.uuid4()),
        "detected_at": datetime.utcnow().isoformat(),
        "severity": severity,
        "description": "[TEST INCIDENT] Manual trigger for frontend HITL validation",
    }
    incidents_state["active_incident"] = test_incident
    return {"status": "test_incident_created", "incident": test_incident}

@app.get("/test/state")
def test_get_state(authorization: Optional[str] = Header(default=None)):
    """Debug endpoint: view current incident and decision state"""
    _require_authenticated_user(authorization)
    return {
        "active_incident": incidents_state["active_incident"],
        "enforcement_decisions": incidents_state["enforcement_decisions"],
        "trust_state": active_state
    }

@app.post("/test/clear")
def test_clear_state(authorization: Optional[str] = Header(default=None)):
    """Debug endpoint: clear all state for fresh test"""
    _require_authenticated_user(authorization)
    incidents_state["active_incident"] = None
    incidents_state["enforcement_decisions"] = []
    active_state["trust_score"] = 1.0
    active_state["intent_drift_detected"] = False
    return {"status": "state_cleared"}

# Audit Log Retrieval Endpoints
@app.get("/audit/decisions")
def get_audit_log():
    """Retrieve all recorded enforcement decisions from audit log"""
    decisions = []
    try:
        if AUDIT_LOG_FILE.exists():
            import json
            with open(AUDIT_LOG_FILE, 'r') as f:
                for line in f:
                    if line.strip():
                        decisions.append(json.loads(line))
    except Exception as e:
        print(f'Error reading audit log: {e}')
    return {"total_decisions": len(decisions), "decisions": decisions}

@app.get("/audit/stats")
def get_audit_stats():
    """Get statistics about enforcement decisions"""
    decisions = []
    try:
        if AUDIT_LOG_FILE.exists():
            import json
            with open(AUDIT_LOG_FILE, 'r') as f:
                for line in f:
                    if line.strip():
                        decisions.append(json.loads(line))
    except Exception as e:
        print(f'Error reading audit log: {e}')
    
    denied = sum(1 for d in decisions if d.get('decision') == 'DENY')
    approved = sum(1 for d in decisions if d.get('decision') == 'ALLOW')
    
    return {
        "total": len(decisions),
        "denied": denied,
        "approved": approved,
        "denial_rate": f"{(denied / len(decisions) * 100):.1f}%" if decisions else "N/A"
    }
