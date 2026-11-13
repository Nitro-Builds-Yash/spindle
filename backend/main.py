"""Top-level FastAPI entrypoint forwarding to app.main:app.

Allows running either:
    uvicorn main:app --reload --port 8000
or
    uvicorn app.main:app --reload --port 8000
"""

from app.main import app

__all__ = ["app"]
