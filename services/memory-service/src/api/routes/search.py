"""Search routes."""

import logging

from fastapi import APIRouter, Request

from src.core.embeddings import embedding_service
from src.models.schemas import (
    ContextRequest,
    ContextResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from src.services.rag import get_rag_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest, req: Request):
    """Perform semantic search over indexed code."""
    vector_store = req.app.state.vector_store

    # Generate query embedding
    query_embedding = embedding_service.embed(request.query)

    # Search
    results = await vector_store.search_similar(
        project_id=request.project_id,
        query_embedding=query_embedding,
        max_results=request.max_results,
        min_similarity=request.min_similarity,
        file_filter=request.file_filter,
    )

    return SearchResponse(
        results=[
            SearchResult(
                file_path=r["file_path"],
                content=r["content"],
                similarity=r["similarity"],
                chunk_index=r["chunk_index"],
                language=r["language"],
            )
            for r in results
        ],
        query=request.query,
        total_results=len(results),
    )


@router.post("/context", response_model=ContextResponse)
async def get_context(request: ContextRequest, req: Request):
    """Get relevant context for a task.

    This endpoint retrieves relevant code snippets and learned patterns
    that can help with implementing a task.
    """
    vector_store = req.app.state.vector_store
    rag_service = get_rag_service(vector_store)

    if request.include_patterns:
        result = await rag_service.get_context_with_patterns(
            project_id=request.project_id,
            query=request.task_description,
            max_tokens=request.max_tokens,
        )
        return ContextResponse(
            context=result["context"],
            sources=result["sources"],
            patterns=result["patterns"],
        )
    else:
        context, sources = await rag_service.get_relevant_context(
            project_id=request.project_id,
            query=request.task_description,
            max_tokens=request.max_tokens,
        )
        return ContextResponse(
            context=context,
            sources=sources,
            patterns=[],
        )
