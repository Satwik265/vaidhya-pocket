"""Application settings and runtime configuration."""

from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    SERVICE_NAME: str = "medscribe-ai-core"
    VERSION: str = "0.1.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
