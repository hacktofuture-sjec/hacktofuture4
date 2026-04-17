"""
Backend package init — loads Celery app so tasks are registered on startup.
"""

from .celery import app as celery_app

__all__ = ("celery_app",)
