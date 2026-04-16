from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import docker, asyncio, json, httpx
from datetime import datetime

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

docker_client = docker.from_env()

SERVICES = {
    "flask-sqli":        {"port": 5000, "vuln": "SQL Injection",         "cve": "CWE-89",       "color": "red"},
    "node-pathtraversal":{"port": 3001, "vuln": "Path Traversal",        "cve": "CWE-22",       "color": "orange"},
    "jwt-auth":          {"port": 3002, "vuln": "JWT None Algorithm",    "cve": "CVE-2015-9235","color": "yellow"},
    "postgres-weak":     {"port": 5432, "vuln": "Weak Credentials",      "cve": "CWE-521",      "color": "purple"},
    "redis-noauth":      {"port": 6379, "vuln": "No Authentication",     "cve": "CVE-2022-0543","color": "pink"},
    "nginx-misconfig":   {"port": 8080, "vuln": "Alias Misconfiguration","cve": "CWE-284",      "color": "blue"},
}

async def check_service_health(name: str, port: int) -> str:
    # Postgres and Redis: keep as is or check via TCP socket
    if name in ("postgres-weak", "redis-noauth"):
        return "up" 
    
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            # CHANGE: 'localhost' -> 'name' (Docker DNS resolution)
            # Note: Inside the network, use the internal port (e.g., 80 for Nginx)
            target_port = 80 if name == "nginx-misconfig" else port
            r = await client.get(f"http://{name}:{target_port}/health")
            return "up" if r.status_code == 200 else "degraded"
    except Exception as e:
        return "down"

@app.get("/api/services")
async def get_services():
    results = []
    for name, meta in SERVICES.items():
        try:
            container = docker_client.containers.get(name)
            docker_status = container.status  # running/exited/etc
        except:
            docker_status = "not_found"

        health = await check_service_health(name, meta["port"])

        results.append({
            "name": name,
            "port": meta["port"],
            "vuln": meta["vuln"],
            "cve": meta["cve"],
            "color": meta["color"],
            "docker_status": docker_status,
            "health": health,
        })
    return results

@app.websocket("/ws/logs")
async def log_stream(ws: WebSocket):
    await ws.accept()
    try:
        containers = [docker_client.containers.get(n) for n in SERVICES if n != "postgres-weak"]
        # Stream logs from all containers in parallel
        while True:
            for container in containers:
                try:
                    logs = container.logs(tail=3, timestamps=True).decode("utf-8", errors="ignore")
                    for line in logs.strip().split("\n"):
                        if line:
                            await ws.send_text(json.dumps({
                                "service": container.name,
                                "log": line.strip(),
                                "ts": datetime.utcnow().isoformat()
                            }))
                except Exception as e:
                    pass
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass