"""
Repository document — a GitHub repository connected to a workspace.
"""

from datetime import datetime, timezone

from beanie import Document, PydanticObjectId
from pydantic import Field


class Repository(Document):
    """A GitHub repository linked to a PipelineIQ workspace."""

    github_repo_id: int
    full_name: str          # e.g. "octocat/Hello-World"
    name: str               # e.g. "Hello-World"
    private: bool = False
    html_url: str
    default_branch: str = "main"
    workspace_id: PydanticObjectId  # references Workspace._id
    connected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    connected_by: PydanticObjectId  # references User._id

    class Settings:
        name = "repositories"
        use_state_management = True
