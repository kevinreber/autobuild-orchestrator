"""Insights and chat routes."""

import logging

import anthropic
from fastapi import APIRouter, HTTPException, Request

from src.core.config import settings
from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    CodebaseSummary,
    LearnedPattern,
    PatternsResponse,
)
from src.services.rag import get_rag_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/insights/chat", response_model=ChatResponse)
async def chat_with_codebase(request: ChatRequest, req: Request):
    """Chat with the codebase using RAG.

    This endpoint retrieves relevant code context and uses Claude
    to answer questions about the codebase.
    """
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    vector_store = req.app.state.vector_store
    rag_service = get_rag_service(vector_store)

    # Get relevant context
    context, sources = await rag_service.get_relevant_context(
        project_id=request.project_id,
        query=request.message,
        max_results=10,
        max_tokens=4000,
    )

    if not context:
        return ChatResponse(
            response="I don't have any indexed code for this project yet. Please index the codebase first.",
            sources=[],
        )

    # Build prompt
    system_prompt = f"""You are a helpful assistant that answers questions about a codebase.
Use the following code context to answer the user's question accurately.
If the context doesn't contain enough information to answer the question, say so.
Always cite the relevant files when providing information.

## Codebase Context
{context}
"""

    # Prepare messages
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})

    # Call Claude
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=system_prompt,
            messages=messages,
        )

        assistant_response = response.content[0].text
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    return ChatResponse(
        response=assistant_response,
        sources=sources,
    )


@router.get("/insights/summary/{project_id}", response_model=CodebaseSummary)
async def get_codebase_summary(project_id: str, req: Request):
    """Get a summary of the indexed codebase.

    Returns statistics about the codebase including file counts,
    languages used, and architecture notes.
    """
    # TODO: Implement full summary generation
    # For now, return basic stats from embeddings

    return CodebaseSummary(
        project_id=project_id,
        total_files=0,
        languages={},
        main_technologies=[],
        architecture_notes="Summary not yet generated. Please index the codebase first.",
    )


@router.get("/insights/patterns/{project_id}", response_model=PatternsResponse)
async def get_learned_patterns(project_id: str, req: Request):
    """Get learned patterns for a project.

    Returns patterns that have been learned from successful
    agent executions on this project.
    """
    vector_store = req.app.state.vector_store

    patterns = await vector_store.get_learned_patterns(project_id)

    return PatternsResponse(
        patterns=[
            LearnedPattern(
                id=p["id"],
                pattern_type=p["pattern_type"],
                pattern_content=p["pattern_content"],
                success_count=p["success_count"],
                failure_count=p["failure_count"],
                last_used_at=p["last_used_at"],
            )
            for p in patterns
        ],
        project_id=project_id,
    )
