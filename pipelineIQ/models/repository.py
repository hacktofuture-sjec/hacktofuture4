from datetime import datetime, timezone

from beanie import Document, PydanticObjectId
from pydantic import Field


class Repository(Document):

    github_repo_id: int
    full_name: str
    name: str
    private: bool = False
    html_url: str
    default_branch: str = "main"
    workspace_id: PydanticObjectId
    connected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    connected_by: PydanticObjectId

    class Settings:
        name = "repositories"
        use_state_management = True
