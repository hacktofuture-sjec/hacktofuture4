"""
Workspace document — a logical container that groups repositories for a user.
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class Workspace(Document):
    """A named workspace owned by a user, containing connected repositories."""

    name: str
    description: Optional[str] = None
    owner_id: PydanticObjectId  # references User._id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "workspaces"
        use_state_management = True
