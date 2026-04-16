from datetime import datetime, timezone
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class AutoFixMemory(Document):
    workspace_id: PydanticObjectId
    repository_full_name: str
    error_signature: str
    memory_type: str
    reviewer_username: Optional[str] = None
    reviewer_github_id: Optional[int] = None
    note: Optional[str] = None
    approved_for_auto_merge: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "autofix_memories"
        use_state_management = True
