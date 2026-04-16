from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from .database import Base


# ── SQLAlchemy ORM Model ──────────────────────────────────────────────────────

class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    title = Column(String(300), nullable=False)
    category = Column(String(60), nullable=False, default="Other")
    source_name = Column(String(100))
    source_url = Column(String(500))
    published_at = Column(String(100))

    # Generated documents
    article_md = Column(Text)
    problem_txt = Column(Text)
    solution_txt = Column(Text)
    architecture_txt = Column(Text)
    implementation_plan_txt = Column(Text)
    monetization_txt = Column(Text)

    # Sample code skeleton
    sample_backend_main = Column(Text)
    sample_backend_models = Column(Text)
    sample_backend_services = Column(Text)
    sample_backend_requirements = Column(Text)
    sample_frontend_app = Column(Text)
    sample_readme = Column(Text)

    download_count = Column(Integer, default=0)
    is_published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ProblemOut(BaseModel):
    id: int
    slug: str
    title: str
    category: str
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    published_at: Optional[str] = None
    download_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProblemDetail(ProblemOut):
    article_md: Optional[str] = None
    problem_txt: Optional[str] = None
    solution_txt: Optional[str] = None
    architecture_txt: Optional[str] = None
    implementation_plan_txt: Optional[str] = None
    monetization_txt: Optional[str] = None
