from fastapi import FastAPI
import httpx

from config import settings
from init_db import init_db
from routers.agents import router as agents_router
from routers.cost import router as cost_router
from routers.fault_injection import router as fault_injection_router
from routers.health import router as health_router
from routers.incidents import router as incidents_router
from routers.memory import router as memory_router
from routers.scenarios import router as scenarios_router


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version)

    @app.on_event("startup")
    async def startup() -> None:
        init_db()

        async with httpx.AsyncClient(timeout=3.0) as client:
            for name, url, path in [
                ("Prometheus", settings.prometheus_url, "/-/healthy"),
                ("Loki", settings.loki_url, "/ready"),
                ("Tempo", settings.tempo_url, "/ready"),
            ]:
                try:
                    response = await client.get(f"{url}{path}")
                    if response.status_code != 200:
                        print(f"WARN: {name} unhealthy at startup: status={response.status_code} url={url}")
                        continue

                    if name in {"Loki", "Tempo"} and response.text.strip() != "ready":
                        print(f"WARN: {name} unhealthy at startup: unexpected body='{response.text.strip()}' url={url}")
                except Exception:
                    print(f"WARN: {name} not reachable at {url}")

    app.include_router(health_router)
    app.include_router(scenarios_router)
    app.include_router(fault_injection_router)
    app.include_router(agents_router)
    app.include_router(incidents_router)
    app.include_router(memory_router)
    app.include_router(cost_router)
    return app


app = create_app()
