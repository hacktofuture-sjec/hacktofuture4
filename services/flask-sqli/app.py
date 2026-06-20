from flask import Flask, request, jsonify
import sqlite3, os, logging, json

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

DB = "/app/data.db"
_PATCHED = False   # flipped by Blue's live-patch

def init_db():
    os.makedirs("/app", exist_ok=True)
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS flags (id INTEGER PRIMARY KEY, flag TEXT)")
    c.executemany("INSERT OR IGNORE INTO users VALUES (?,?,?)", [
        (1,"alice","alice@corp.com"),
        (2,"bob","bob@corp.com"),
        (3,"admin","admin@corp.com"),
    ])
    c.execute("INSERT OR IGNORE INTO flags VALUES (1, 'FLAG{sql_inject10n_pwned}')")
    conn.commit(); conn.close()

@app.before_request
def log_request():
    app.logger.info(json.dumps({
        "event": "request",
        "method": request.method,
        "path": request.path,
        "args": dict(request.args),
        "ip": request.remote_addr,
        "service": "flask-sqli"
    }))

@app.route("/api/users")
def get_users():
    name = request.args.get("name", "")
    if _PATCHED:
        # SAFE: parameterised query — SQLi is neutralised
        conn = sqlite3.connect(DB)
        rows = conn.execute("SELECT id, name, email FROM users WHERE name = ?", (name,)).fetchall()
        conn.close()
        return jsonify({"users": [{"id": r[0], "name": r[1], "email": r[2]} for r in rows]})
    # !! VULNERABLE: raw string interpolation into SQL !!
    query = f"SELECT id, name, email FROM users WHERE name = '{name}'"
    try:
        conn = sqlite3.connect(DB)
        rows = conn.execute(query).fetchall()
        conn.close()
        return jsonify({"users": [{"id": r[0], "name": r[1], "email": r[2]} for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/patch", methods=["POST"])
def admin_patch():
    global _PATCHED
    _PATCHED = True
    app.logger.info("[PATCH] SQLi vulnerability patched — parameterised queries enabled")
    return jsonify({"status": "patched", "service": "flask-sqli"})

@app.route("/health")
def health():
    return jsonify({"status": "up", "service": "flask-sqli"})

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)