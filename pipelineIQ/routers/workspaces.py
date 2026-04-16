"""
Workspace CRUD routes.
"""

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth.dependencies import get_current_user
from models.repository import Repository
from models.user import User
from models.workspace import Workspace

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


# ── Request / Response schemas ─────────────────────────────────────
class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


# ── Routes ─────────────────────────────────────────────────────────
@router.get("")
async def list_workspaces(user: User = Depends(get_current_user)):
    """Return all workspaces owned by the current user."""
    workspaces = await Workspace.find(Workspace.owner_id == user.id).to_list()
    results = []
    for ws in workspaces:
        repo_count = await Repository.find(Repository.workspace_id == ws.id).count()
        results.append(
            {
                "id": str(ws.id),
                "name": ws.name,
                "description": ws.description,
                "repo_count": repo_count,
                "created_at": ws.created_at.isoformat(),
                "updated_at": ws.updated_at.isoformat(),
            }
        )
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate, user: User = Depends(get_current_user)
):
    """Create a new workspace for the current user."""
    now = datetime.now(timezone.utc)
    ws = Workspace(
        name=body.name,
        description=body.description,
        owner_id=user.id,
        created_at=now,
        updated_at=now,
    )
    await ws.insert()
    return {
        "id": str(ws.id),
        "name": ws.name,
        "description": ws.description,
        "created_at": ws.created_at.isoformat(),
        "updated_at": ws.updated_at.isoformat(),
    }


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str, user: User = Depends(get_current_user)
):
    """Get a single workspace with its connected repositories."""
    ws = await Workspace.get(PydanticObjectId(workspace_id))
    if ws is None or ws.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    repos = await Repository.find(Repository.workspace_id == ws.id).to_list()
    return {
        "id": str(ws.id),
        "name": ws.name,
        "description": ws.description,
        "created_at": ws.created_at.isoformat(),
        "updated_at": ws.updated_at.isoformat(),
        "repositories": [
            {
                "id": str(r.id),
                "github_repo_id": r.github_repo_id,
                "full_name": r.full_name,
                "name": r.name,
                "private": r.private,
                "html_url": r.html_url,
                "default_branch": r.default_branch,
                "connected_at": r.connected_at.isoformat(),
            }
            for r in repos
        ],
    }


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    user: User = Depends(get_current_user),
):
    """Update a workspace's name or description."""
    ws = await Workspace.get(PydanticObjectId(workspace_id))
    if ws is None or ws.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if body.name is not None:
        ws.name = body.name
    if body.description is not None:
        ws.description = body.description
    ws.updated_at = datetime.now(timezone.utc)
    await ws.save()
    return {"detail": "Workspace updated"}


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str, user: User = Depends(get_current_user)
):
    """Delete a workspace and all its connected repositories."""
    ws = await Workspace.get(PydanticObjectId(workspace_id))
    if ws is None or ws.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Remove connected repos first
    await Repository.find(Repository.workspace_id == ws.id).delete()
    await ws.delete()
