from fastapi import APIRouter

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/similar-incidents")
def similar_incidents() -> dict:
    return {"items": [], "message": "Memory lookup stub"}
