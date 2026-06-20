"""
Blue Agent Response Executor
Applies real countermeasures to the Docker cluster.

Supports live-patching for all 6 services:
  ✅ redis-noauth     — CONFIG SET requirepass
  ✅ jwt-auth         — touch flag file to disable alg:none
  ✅ flask-sqli       — POST /admin/patch → parameterised queries
  ✅ node-pathtraversal — POST /admin/patch → path.resolve guard
  ✅ nginx-misconfig  — overwrite nginx.conf + reload
  ✅ postgres-weak    — ALTER USER password
"""
import docker, httpx, asyncio, logging

log = logging.getLogger("responses")
_docker = docker.from_env()

# ── IP blocking / unblocking ──────────────────────────────────────────────────

async def block_ip(ip: str, service: str = None):
    """VIRTUAL block — logs the decision, does NOT modify iptables."""
    targets = [service] if service else [
        "flask-sqli","node-pathtraversal","jwt-auth","nginx-misconfig"
    ]
    for name in targets:
        log.info(f"[Blue][VIRTUAL-BLOCK] WOULD block {ip} on {name}")

async def unblock_ip(ip: str):
    log.info(f"[Blue][VIRTUAL-BLOCK] WOULD unblock {ip}")

# ── Rate limiting ─────────────────────────────────────────────────────────────

async def add_rate_limit(service: str, ip: str, max_req: int = 10):
    """VIRTUAL rate-limit — logs what iptables would do, enforces nothing."""
    log.info(f"[Blue][VIRTUAL-RATE-LIMIT] WOULD rate-limit {ip} on {service} "
             f"({max_req} req/min)")
    return True

# ── Service restart ───────────────────────────────────────────────────────────

async def restart_service(name: str):
    try:
        c = _docker.containers.get(name)
        c.restart(timeout=5)
        log.info(f"[Blue] restarted {name}")
        return True
    except Exception as e:
        log.warning(f"[Blue] restart failed {name}: {e}")
        return False

# ── Live-patch functions ──────────────────────────────────────────────────────

async def patch_redis():
    """Set requirepass on the running Redis instance."""
    try:
        import redis as redis_lib
        r = redis_lib.Redis(host="localhost", port=6379, socket_timeout=2)
        r.config_set("requirepass", "blue_patched_secret")
        log.info("[Blue] Redis: requirepass set")
        return True
    except Exception as e:
        log.warning(f"[Blue] patch_redis failed: {e}")
        return False

async def patch_jwt():
    """POST to jwt-auth's admin endpoint to disable alg:none at runtime."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.post("http://jwt-auth:3002/admin/patch")
            if r.status_code == 200:
                log.info("[Blue] JWT: alg:none vulnerability patched via HTTP")
                return True
            log.warning(f"[Blue] patch_jwt: status {r.status_code}")
            return False
    except Exception as e:
        log.warning(f"[Blue] patch_jwt failed: {e}")
        return False

async def patch_flask_sqli():
    """POST to flask-sqli's admin endpoint to enable parameterised queries."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.post("http://flask-sqli:5000/admin/patch")
            if r.status_code == 200:
                log.info("[Blue] Flask-SQLi: parameterised queries enabled")
                return True
            log.warning(f"[Blue] patch_flask_sqli: status {r.status_code}")
            return False
    except Exception as e:
        log.warning(f"[Blue] patch_flask_sqli failed: {e}")
        return False

async def patch_node_pathtraversal():
    """POST to node-pathtraversal's admin endpoint to enable path.resolve guard."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.post("http://node-pathtraversal:3001/admin/patch")
            if r.status_code == 200:
                log.info("[Blue] Node: path.resolve guard enabled")
                return True
            log.warning(f"[Blue] patch_node: status {r.status_code}")
            return False
    except Exception as e:
        log.warning(f"[Blue] patch_node_pathtraversal failed: {e}")
        return False

async def patch_nginx():
    """Overwrite nginx config to fix the alias traversal and reload."""
    safe_conf = """
worker_processes 1;
events { worker_connections 1024; }
http {
  server {
    listen 80;
    location /static/ {
      alias /var/www/app/static/;
    }
    location /health {
      return 200 '{"status":"up","service":"nginx-misconfig"}';
      add_header Content-Type application/json;
    }
  }
}
"""
    try:
        c = _docker.containers.get("nginx-misconfig")
        # Write the safe config via exec
        import tempfile
        c.exec_run(f"sh -c 'cat > /etc/nginx/nginx.conf << ENDCONF{safe_conf}ENDCONF'")
        # Reload nginx without restart
        result = c.exec_run("nginx -s reload")
        if result.exit_code == 0:
            log.info("[Blue] Nginx: alias traversal patched + reloaded")
            return True
        log.warning(f"[Blue] nginx reload exit code: {result.exit_code}")
        return False
    except Exception as e:
        log.warning(f"[Blue] patch_nginx failed: {e}")
        return False

async def patch_postgres():
    """Change the weak postgres password to a strong one."""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost", port=5432, dbname="targetdb",
            user="postgres", password="postgres", connect_timeout=3,
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("ALTER USER postgres WITH PASSWORD 'blue_s3cure_p@ss!'")
        cur.close()
        conn.close()
        log.info("[Blue] Postgres: password changed to strong credentials")
        return True
    except Exception as e:
        log.warning(f"[Blue] patch_postgres failed: {e}")
        return False

# ── Patch registry — maps service name to patch function ──────────────────────
PATCH_REGISTRY = {
    "redis-noauth":       patch_redis,
    "jwt-auth":           patch_jwt,
    "flask-sqli":         patch_flask_sqli,
    "node-pathtraversal": patch_node_pathtraversal,
    "nginx-misconfig":    patch_nginx,
    "postgres-weak":      patch_postgres,
}