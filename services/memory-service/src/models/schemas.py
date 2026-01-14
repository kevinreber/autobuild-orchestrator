"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ============ Embedding Schemas ============


class IndexRepositoryRequest(BaseModel):
    """Request to index a repository."""

    project_id: str
    repo_url: str
    branch: str = "main"
    file_patterns: List[str] = Field(default=["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.go"])


class IndexFilesRequest(BaseModel):
    """Request to index specific files."""

    project_id: str
    files: List[dict]  # [{"path": "...", "content": "..."}]


class IndexResponse(BaseModel):
    """Response after indexing."""

    project_id: str
    files_indexed: int
    chunks_created: int
    status: str


# ============ Search Schemas ============


class SearchRequest(BaseModel):
    """Semantic search request."""

    project_id: str
    query: str
    max_results: int = 10
    file_filter: Optional[str] = None
    min_similarity: float = 0.5


class SearchResult(BaseModel):
    """Single search result."""

    file_path: str
    content: str
    similarity: float
    chunk_index: int
    language: Optional[str] = None


class SearchResponse(BaseModel):
    """Search response."""

    results: List[SearchResult]
    query: str
    total_results: int


class ContextRequest(BaseModel):
    """Request for relevant context."""

    project_id: str
    task_description: str
    max_tokens: int = 2000
    include_patterns: bool = True


class ContextResponse(BaseModel):
    """Context response."""

    context: str
    sources: List[str]
    patterns: List[dict] = []


# ============ Memory Schemas ============


class CreateMemoryRequest(BaseModel):
    """Request to create a memory."""

    project_id: str
    ticket_id: Optional[str] = None
    memory_type: str  # execution_success, pattern, insight, feedback
    content: dict


class Memory(BaseModel):
    """Memory record."""

    id: str
    project_id: str
    ticket_id: Optional[str]
    memory_type: str
    content: dict
    created_at: datetime


class MemoryListResponse(BaseModel):
    """List of memories."""

    memories: List[Memory]
    total: int


# ============ Insights Schemas ============


class ChatRequest(BaseModel):
    """Chat with codebase request."""

    project_id: str
    message: str
    conversation_history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    """Chat response."""

    response: str
    sources: List[str]


class CodebaseSummary(BaseModel):
    """Summary of a codebase."""

    project_id: str
    total_files: int
    languages: dict  # language -> file count
    main_technologies: List[str]
    architecture_notes: str


class LearnedPattern(BaseModel):
    """A learned pattern."""

    id: str
    pattern_type: str
    pattern_content: dict
    success_count: int
    failure_count: int
    last_used_at: datetime


class PatternsResponse(BaseModel):
    """List of learned patterns."""

    patterns: List[LearnedPattern]
    project_id: str


# ============ Changelog Schemas ============


class GenerateChangelogRequest(BaseModel):
    """Request to generate changelog."""

    project_id: str
    from_ref: str  # commit or tag
    to_ref: str = "HEAD"
    format: str = "markdown"  # markdown, json


class ChangelogEntry(BaseModel):
    """Single changelog entry."""

    type: str  # feature, fix, refactor, etc.
    description: str
    ticket_id: Optional[str] = None
    pr_number: Optional[int] = None
    commit_hash: str


class ChangelogResponse(BaseModel):
    """Generated changelog."""

    project_id: str
    from_ref: str
    to_ref: str
    entries: List[ChangelogEntry]
    markdown: Optional[str] = None
