"""
AutoBuild Memory & Insights Service

A FastAPI-based service for codebase indexing, semantic search,
and memory management for the AutoBuild Orchestrator platform.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import embeddings, insights, memory, search, changelog
from src.core.config import settings
from src.services.vector_store import VectorStore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Memory Service...")

    # Initialize vector store
    app.state.vector_store = VectorStore(settings.database_url)
    await app.state.vector_store.initialize()

    logger.info(f"Memory Service started on {settings.host}:{settings.port}")

    yield

    # Cleanup
    logger.info("Shutting down Memory Service...")
    await app.state.vector_store.close()


# Create FastAPI app
app = FastAPI(
    title="AutoBuild Memory Service",
    description="Memory and Insights Service for AutoBuild Orchestrator",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "service": "memory-service",
    }


# Include routers
app.include_router(embeddings.router, prefix="/api/v1", tags=["embeddings"])
app.include_router(search.router, prefix="/api/v1", tags=["search"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(insights.router, prefix="/api/v1", tags=["insights"])
app.include_router(changelog.router, prefix="/api/v1", tags=["changelog"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
