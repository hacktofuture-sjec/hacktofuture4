from fastapi import FastAPI

from config import get_settings
from init_db import init_db
from routers.agents import router as agents_router
from routers.cost import router as cost_router
from routers.fault_injection import router as fault_injection_router
from routers.health import router as health_router
from routers.incidents import router as incidents_router
from routers.memory import router as memory_router
from routers.scenarios import router as scenarios_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version)

    @app.on_event("startup")
    def startup() -> None:
        init_db()

    app.include_router(health_router)
    app.include_router(scenarios_router)
    app.include_router(fault_injection_router)
    app.include_router(incidents_router)
    app.include_router(agents_router)
    app.include_router(memory_router)
    app.include_router(cost_router)
    return app


app = create_app()
