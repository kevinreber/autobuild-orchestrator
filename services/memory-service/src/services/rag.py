"""RAG (Retrieval Augmented Generation) service."""

import logging
from typing import List, Optional

from src.core.embeddings import embedding_service
from src.services.vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGService:
    """Service for retrieval augmented generation."""

    def __init__(self, vector_store: VectorStore):
        """Initialize the RAG service.

        Args:
            vector_store: Vector store instance.
        """
        self.vector_store = vector_store
        self.embeddings = embedding_service

    async def get_relevant_context(
        self,
        project_id: str,
        query: str,
        max_results: int = 5,
        max_tokens: int = 2000,
    ) -> tuple[str, List[str]]:
        """Retrieve relevant code context for a task.

        Args:
            project_id: Project to search in.
            query: Task description or query.
            max_results: Maximum number of results to retrieve.
            max_tokens: Maximum tokens in the context.

        Returns:
            Tuple of (formatted context string, list of source files).
        """
        # Generate query embedding
        query_embedding = self.embeddings.embed(query)

        # Search for similar chunks
        results = await self.vector_store.search_similar(
            project_id=project_id,
            query_embedding=query_embedding,
            max_results=max_results,
            min_similarity=0.3,
        )

        if not results:
            return "", []

        # Format context
        context_parts = []
        sources = []
        total_tokens = 0

        for result in results:
            file_path = result["file_path"]
            content = result["content"]
            similarity = result["similarity"]

            # Format chunk
            chunk = f"## {file_path} (similarity: {similarity:.2f})\n```\n{content}\n```\n"
            chunk_tokens = self.embeddings.count_tokens(chunk)

            if total_tokens + chunk_tokens > max_tokens:
                break

            context_parts.append(chunk)
            sources.append(file_path)
            total_tokens += chunk_tokens

        context = "\n".join(context_parts)
        return context, sources

    async def get_context_with_patterns(
        self,
        project_id: str,
        query: str,
        max_tokens: int = 2000,
    ) -> dict:
        """Get context including learned patterns.

        Args:
            project_id: Project to search in.
            query: Task description.
            max_tokens: Maximum tokens in context.

        Returns:
            Dict with context, sources, and patterns.
        """
        # Get code context
        context, sources = await self.get_relevant_context(
            project_id=project_id,
            query=query,
            max_results=10,
            max_tokens=int(max_tokens * 0.7),  # Reserve space for patterns
        )

        # Get relevant patterns
        patterns = await self.vector_store.get_learned_patterns(project_id)

        # Filter patterns by relevance (simple keyword matching for now)
        query_lower = query.lower()
        relevant_patterns = [
            p
            for p in patterns
            if any(
                keyword in query_lower
                for keyword in str(p.get("pattern_content", {})).lower().split()
            )
        ][:5]

        # Format patterns
        pattern_context = ""
        if relevant_patterns:
            pattern_parts = ["## Learned Patterns from Previous Work"]
            for p in relevant_patterns:
                pattern_parts.append(
                    f"- **{p['pattern_type']}** (used {p['success_count']} times): {p['pattern_content']}"
                )
            pattern_context = "\n".join(pattern_parts)

        # Combine context
        full_context = context
        if pattern_context:
            full_context = f"{pattern_context}\n\n{context}"

        return {
            "context": full_context,
            "sources": sources,
            "patterns": relevant_patterns,
        }


# Factory function to create RAG service from app state
def get_rag_service(vector_store: VectorStore) -> RAGService:
    """Create a RAG service instance.

    Args:
        vector_store: Vector store from app state.

    Returns:
        RAGService instance.
    """
    return RAGService(vector_store)
