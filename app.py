"""Vercel entrypoint — re-exports ASGI app."""

from main import app

__all__ = ["app"]
