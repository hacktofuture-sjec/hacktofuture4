# What it does:
# Receives telemetry snapshots.

# PPT Module:
# Telemetry Collection
from fastapi import APIRouter
from telemetry.aggregator import collect_signals

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.get("/collect")
def collect():
    data = collect_signals()
    return {"telemetry": data}