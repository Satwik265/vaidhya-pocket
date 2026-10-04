"""Health and service status endpoints."""

from fastapi import APIRouter
from ...core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health():
    """Service liveness and health status."""
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
    }


@router.get("/version")
def get_version():
    """Current clinical AI core version."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
    }
