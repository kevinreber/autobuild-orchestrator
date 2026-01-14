"""Embedding and indexing routes."""

import hashlib
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Request

from src.core.embeddings import embedding_service
from src.models.schemas import (
    IndexFilesRequest,
    IndexRepositoryRequest,
    IndexResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/index/repository", response_model=IndexResponse)
async def index_repository(request: IndexRepositoryRequest, req: Request):
    """Index an entire repository.

    This endpoint clones the repository and indexes all matching files.
    """
    # TODO: Implement repository cloning and indexing
    logger.info(f"Indexing repository: {request.repo_url} for project {request.project_id}")

    return IndexResponse(
        project_id=request.project_id,
        files_indexed=0,
        chunks_created=0,
        status="not_implemented",
    )


@router.post("/index/files", response_model=IndexResponse)
async def index_files(request: IndexFilesRequest, req: Request):
    """Index specific files.

    This endpoint indexes provided file contents directly.
    """
    vector_store = req.app.state.vector_store

    files_indexed = 0
    chunks_created = 0

    for file_info in request.files:
        file_path = file_info.get("path", "")
        content = file_info.get("content", "")

        if not file_path or not content:
            continue

        # Detect language from extension
        language = detect_language(file_path)

        # Chunk the content
        chunks = embedding_service.chunk_code(content, language)

        for chunk in chunks:
            chunk_content = chunk["content"]
            chunk_index = chunk["index"]

            # Generate content hash
            content_hash = hashlib.sha256(chunk_content.encode()).hexdigest()

            # Generate embedding
            embedding = embedding_service.embed(chunk_content)

            # Store in vector database
            await vector_store.upsert_embedding(
                project_id=request.project_id,
                file_path=file_path,
                content=chunk_content,
                content_hash=content_hash,
                embedding=embedding,
                chunk_index=chunk_index,
                language=language,
            )

            chunks_created += 1

        files_indexed += 1

    logger.info(
        f"Indexed {files_indexed} files, {chunks_created} chunks for project {request.project_id}"
    )

    return IndexResponse(
        project_id=request.project_id,
        files_indexed=files_indexed,
        chunks_created=chunks_created,
        status="completed",
    )


@router.delete("/index/{project_id}")
async def delete_index(project_id: str, req: Request):
    """Delete all embeddings for a project."""
    vector_store = req.app.state.vector_store

    deleted = await vector_store.delete_project_embeddings(project_id)

    logger.info(f"Deleted {deleted} embeddings for project {project_id}")

    return {"project_id": project_id, "deleted_count": deleted}


def detect_language(file_path: str) -> str | None:
    """Detect programming language from file extension."""
    extension_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
        ".rb": "ruby",
        ".php": "php",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".vue": "vue",
        ".svelte": "svelte",
    }

    for ext, lang in extension_map.items():
        if file_path.endswith(ext):
            return lang

    return None
