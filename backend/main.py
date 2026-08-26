from fastapi import FastAPI
from backend.routes import telemetry, analyze, recovery

app = FastAPI(title="Autonomous Recovery System")

app.include_router(telemetry.router)
app.include_router(analyze.router)
app.include_router(recovery.router)

@app.get("/")
def root():
    return {"message": "Decision-Driven Autonomous Recovery API Running"}