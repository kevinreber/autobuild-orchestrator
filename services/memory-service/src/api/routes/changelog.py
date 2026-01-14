"""Changelog generation routes."""

import logging

from fastapi import APIRouter, HTTPException, Request

from src.models.schemas import (
    ChangelogEntry,
    ChangelogResponse,
    GenerateChangelogRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/changelog/generate", response_model=ChangelogResponse)
async def generate_changelog(request: GenerateChangelogRequest, req: Request):
    """Generate a changelog from git commits.

    Analyzes commits between two refs and generates a formatted
    changelog using AI to categorize and summarize changes.
    """
    # TODO: Implement changelog generation
    # This would:
    # 1. Clone/fetch the repository
    # 2. Get commits between from_ref and to_ref
    # 3. Use Claude to analyze and categorize changes
    # 4. Generate formatted changelog

    logger.info(
        f"Generating changelog for project {request.project_id} from {request.from_ref} to {request.to_ref}"
    )

    # Placeholder response
    return ChangelogResponse(
        project_id=request.project_id,
        from_ref=request.from_ref,
        to_ref=request.to_ref,
        entries=[],
        markdown="# Changelog\n\nChangelog generation not yet implemented.",
    )
