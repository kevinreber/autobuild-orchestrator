"""Memory management routes."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from src.models.schemas import (
    CreateMemoryRequest,
    Memory,
    MemoryListResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/memory", response_model=Memory)
async def create_memory(request: CreateMemoryRequest, req: Request):
    """Create a new memory record.

    Memories can store insights from successful executions, patterns,
    user feedback, and other learnings.
    """
    vector_store = req.app.state.vector_store

    memory_id = await vector_store.create_memory(
        project_id=request.project_id,
        memory_type=request.memory_type,
        content=request.content,
        ticket_id=request.ticket_id,
    )

    logger.info(
        f"Created memory {memory_id} of type {request.memory_type} for project {request.project_id}"
    )

    # Fetch the created memory
    memories = await vector_store.get_memories(request.project_id)
    created_memory = next((m for m in memories if m["id"] == memory_id), None)

    if not created_memory:
        raise HTTPException(status_code=500, detail="Failed to retrieve created memory")

    return Memory(
        id=created_memory["id"],
        project_id=created_memory["project_id"],
        ticket_id=created_memory["ticket_id"],
        memory_type=created_memory["memory_type"],
        content=created_memory["content"],
        created_at=created_memory["created_at"],
    )


@router.get("/memory/{project_id}", response_model=MemoryListResponse)
async def get_memories(
    project_id: str,
    req: Request,
    memory_type: Optional[str] = None,
    limit: int = 100,
):
    """Get memories for a project.

    Optionally filter by memory type.
    """
    vector_store = req.app.state.vector_store

    memories = await vector_store.get_memories(
        project_id=project_id,
        memory_type=memory_type,
        limit=limit,
    )

    return MemoryListResponse(
        memories=[
            Memory(
                id=m["id"],
                project_id=m["project_id"],
                ticket_id=m["ticket_id"],
                memory_type=m["memory_type"],
                content=m["content"],
                created_at=m["created_at"],
            )
            for m in memories
        ],
        total=len(memories),
    )


@router.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str, req: Request):
    """Delete a memory record."""
    # TODO: Implement delete
    logger.info(f"Deleting memory {memory_id}")

    return {"message": "Memory deleted", "id": memory_id}
