from datetime import datetime, timezone

import httpx
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth.dependencies import get_current_user
from models.repository import Repository
from models.user import User
from models.workspace import Workspace

router = APIRouter(tags=["repositories"])

GITHUB_REPOS_URL = "https://api.github.com/user/repos"


class ConnectRepoBody(BaseModel):
    github_repo_id: int
    full_name: str
    name: str
    private: bool = False
    html_url: str
    default_branch: str = "main"


@router.get("/api/repositories/github")
async def list_github_repos(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GITHUB_REPOS_URL,
            params={
                "sort": "updated",
                "direction": "desc",
                "per_page": per_page,
                "page": page,
                "affiliation": "owner,collaborator,organization_member",
            },
            headers={
                "Authorization": f"Bearer {user.github_access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch repositories from GitHub",
        )

    repos = resp.json()
    return [
        {
            "github_repo_id": r["id"],
            "full_name": r["full_name"],
            "name": r["name"],
            "private": r["private"],
            "html_url": r["html_url"],
            "default_branch": r.get("default_branch", "main"),
            "description": r.get("description"),
            "language": r.get("language"),
            "updated_at": r.get("updated_at"),
        }
        for r in repos
    ]


@router.post(
    "/api/workspaces/{workspace_id}/repos",
    status_code=status.HTTP_201_CREATED,
)
async def connect_repo(
    workspace_id: str,
    body: ConnectRepoBody,
    user: User = Depends(get_current_user),
):
    ws = await Workspace.get(PydanticObjectId(workspace_id))
    if ws is None or ws.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    existing = await Repository.find_one(
        Repository.github_repo_id == body.github_repo_id,
        Repository.workspace_id == ws.id,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository already connected to this workspace",
        )

    repo = Repository(
        github_repo_id=body.github_repo_id,
        full_name=body.full_name,
        name=body.name,
        private=body.private,
        html_url=body.html_url,
        default_branch=body.default_branch,
        workspace_id=ws.id,
        connected_at=datetime.now(timezone.utc),
        connected_by=user.id,
    )
    await repo.insert()
    return {
        "id": str(repo.id),
        "full_name": repo.full_name,
        "name": repo.name,
        "connected_at": repo.connected_at.isoformat(),
    }


@router.delete(
    "/api/workspaces/{workspace_id}/repos/{repo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def disconnect_repo(
    workspace_id: str,
    repo_id: str,
    user: User = Depends(get_current_user),
):
    ws = await Workspace.get(PydanticObjectId(workspace_id))
    if ws is None or ws.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Workspace not found")

    repo = await Repository.get(PydanticObjectId(repo_id))
    if repo is None or repo.workspace_id != ws.id:
        raise HTTPException(status_code=404, detail="Repository not found")

    await repo.delete()
