from flask import Flask, request, jsonify
import jwt, json, logging, os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

SECRET = "supersecret_key_never_used"
FLAG   = "FLAG{jwt_n0ne_alg_bypass}"

# Flipped by Blue's live-patch — once True, alg:none is rejected
_PATCHED = os.path.exists("/app/.disable_none_alg")


@app.before_request
def _reload_patch_flag():
    """Re-check flag file on every request so docker-exec patch takes effect."""
    global _PATCHED
    if not _PATCHED:
        _PATCHED = os.path.exists("/app/.disable_none_alg")


@app.before_request
def log_req():
    app.logger.info(json.dumps({
        "event": "request", "method": request.method,
        "path": request.path, "ip": request.remote_addr,
        "service": "jwt-auth", "auth": request.headers.get("Authorization", ""),
    }))


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    if data.get("user") == "admin" and data.get("password") == "secret":
        token = jwt.encode({"user": "admin", "role": "superuser"}, SECRET, algorithm="HS256")
        return jsonify({"token": token})
    return jsonify({"error": "invalid credentials"}), 401


@app.route("/admin/secret")
def admin_secret():
    auth  = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "")
    try:
        if _PATCHED:
            # PATCHED: enforce signature + algorithms whitelist — rejects alg:none
            decoded = jwt.decode(token, SECRET, algorithms=["HS256"])
        else:
            # !! VULNERABLE: verify_signature=False accepts alg:none !!
            decoded = jwt.decode(token, options={"verify_signature": False})

        if decoded.get("role") == "superuser":
            return jsonify({"flag": FLAG, "message": "Welcome, admin"})
        return jsonify({"error": "insufficient role"}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 401


@app.route("/admin/patch", methods=["POST"])
def admin_patch():
    """Blue agent calls this to harden the JWT verification in-process."""
    global _PATCHED
    _PATCHED = True
    # Also write the sentinel file so docker-exec path works too
    with open("/app/.disable_none_alg", "w") as f:
        f.write("patched")
    app.logger.info("[PATCH] JWT alg:none vulnerability patched")
    return jsonify({"status": "patched", "service": "jwt-auth"})


@app.route("/health")
def health():
    return jsonify({"status": "up", "service": "jwt-auth", "patched": _PATCHED})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3002, debug=False)