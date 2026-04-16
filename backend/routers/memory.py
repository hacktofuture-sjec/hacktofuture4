from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Query

from db import get_db_dep
from memory.incident_memory_store import IncidentMemoryStore

router = APIRouter()


@router.get("/similar-incidents")
def similar_incidents(
    failure_class: str = Query(...),
    db: sqlite3.Connection = Depends(get_db_dep),
):
    store = IncidentMemoryStore(db)
    return store.get_ranked_fixes(failure_class)
