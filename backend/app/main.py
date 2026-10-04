"""FastAPI Application Entrypoint for MedScribeAI Clinical Core."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.logging import logger
from .api.routes import health, clinical, ocr, asr


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Initialized {settings.SERVICE_NAME} v{settings.VERSION}")
    yield


app = FastAPI(
    title="MedScribeAI Clinical Core",
    description="Sovereign, offline-first clinical AI platform for Indian outpatient care.",
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS middleware for local frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router)
app.include_router(clinical.router)
app.include_router(ocr.router)
app.include_router(asr.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.HOST, port=settings.PORT, reload=False)
