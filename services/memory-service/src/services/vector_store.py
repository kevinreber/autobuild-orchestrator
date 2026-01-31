"""Vector store service using pgvector."""

import logging
from typing import List, Optional
from uuid import uuid4

import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)


class VectorStore:
    """Vector store backed by PostgreSQL with pgvector."""

    def __init__(self, database_url: str):
        """Initialize the vector store.

        Args:
            database_url: PostgreSQL connection URL.
        """
        self.database_url = database_url
        self.engine = create_async_engine(database_url, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def initialize(self):
        """Initialize the database tables."""
        async with self.engine.begin() as conn:
            # Enable pgvector extension
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

            # Create code_embeddings table if not exists
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS code_embeddings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    content TEXT NOT NULL,
                    content_hash VARCHAR(64) NOT NULL,
                    embedding vector(384) NOT NULL,
                    chunk_index INTEGER DEFAULT 0,
                    language VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )

            # Create indexes
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_code_embeddings_project ON code_embeddings(project_id)"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_code_embeddings_hash ON code_embeddings(content_hash)"
                )
            )

            # Create project_memories table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS project_memories (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL,
                    ticket_id UUID,
                    memory_type VARCHAR(50) NOT NULL,
                    content JSONB NOT NULL,
                    embedding vector(384),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )

            # Create learned_patterns table
            await conn.execute(
                text("""
                CREATE TABLE IF NOT EXISTS learned_patterns (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id UUID NOT NULL,
                    pattern_type VARCHAR(100) NOT NULL,
                    pattern_content JSONB NOT NULL,
                    success_count INTEGER DEFAULT 1,
                    failure_count INTEGER DEFAULT 0,
                    last_used_at TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )

        logger.info("Vector store initialized")

    async def close(self):
        """Close database connections."""
        await self.engine.dispose()

    async def upsert_embedding(
        self,
        project_id: str,
        file_path: str,
        content: str,
        content_hash: str,
        embedding: np.ndarray,
        chunk_index: int = 0,
        language: Optional[str] = None,
    ) -> str:
        """Insert or update a code embedding.

        Args:
            project_id: Project identifier.
            file_path: Path to the file.
            content: Text content.
            content_hash: Hash of the content.
            embedding: Embedding vector.
            chunk_index: Index of the chunk within the file.
            language: Programming language.

        Returns:
            ID of the embedding record.
        """
        async with self.async_session() as session:
            # Check if exists
            result = await session.execute(
                text(
                    """
                SELECT id FROM code_embeddings
                WHERE project_id = :project_id
                AND file_path = :file_path
                AND chunk_index = :chunk_index
            """
                ),
                {
                    "project_id": project_id,
                    "file_path": file_path,
                    "chunk_index": chunk_index,
                },
            )
            existing = result.fetchone()

            embedding_list = embedding.tolist()

            if existing:
                # Update
                await session.execute(
                    text(
                        """
                    UPDATE code_embeddings
                    SET content = :content, content_hash = :content_hash,
                        embedding = :embedding, language = :language, updated_at = NOW()
                    WHERE id = :id
                """
                    ),
                    {
                        "id": existing[0],
                        "content": content,
                        "content_hash": content_hash,
                        "embedding": embedding_list,
                        "language": language,
                    },
                )
                record_id = str(existing[0])
            else:
                # Insert
                record_id = str(uuid4())
                await session.execute(
                    text(
                        """
                    INSERT INTO code_embeddings
                    (id, project_id, file_path, content, content_hash, embedding, chunk_index, language)
                    VALUES (:id, :project_id, :file_path, :content, :content_hash, :embedding, :chunk_index, :language)
                """
                    ),
                    {
                        "id": record_id,
                        "project_id": project_id,
                        "file_path": file_path,
                        "content": content,
                        "content_hash": content_hash,
                        "embedding": embedding_list,
                        "chunk_index": chunk_index,
                        "language": language,
                    },
                )

            await session.commit()
            return record_id

    async def search_similar(
        self,
        project_id: str,
        query_embedding: np.ndarray,
        max_results: int = 10,
        min_similarity: float = 0.5,
        file_filter: Optional[str] = None,
    ) -> List[dict]:
        """Search for similar code chunks.

        Args:
            project_id: Project to search in.
            query_embedding: Query embedding vector.
            max_results: Maximum number of results.
            min_similarity: Minimum similarity threshold.
            file_filter: Optional file path filter (glob pattern).

        Returns:
            List of matching chunks with similarity scores.
        """
        async with self.async_session() as session:
            query = """
                SELECT
                    file_path,
                    content,
                    chunk_index,
                    language,
                    1 - (embedding <=> :embedding) as similarity
                FROM code_embeddings
                WHERE project_id = :project_id
                AND 1 - (embedding <=> :embedding) >= :min_similarity
            """

            if file_filter:
                query += " AND file_path LIKE :file_filter"

            query += " ORDER BY embedding <=> :embedding LIMIT :max_results"

            params = {
                "project_id": project_id,
                "embedding": query_embedding.tolist(),
                "min_similarity": min_similarity,
                "max_results": max_results,
            }

            if file_filter:
                params["file_filter"] = file_filter.replace("*", "%")

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            return [
                {
                    "file_path": row[0],
                    "content": row[1],
                    "chunk_index": row[2],
                    "language": row[3],
                    "similarity": float(row[4]),
                }
                for row in rows
            ]

    async def delete_project_embeddings(self, project_id: str) -> int:
        """Delete all embeddings for a project.

        Args:
            project_id: Project to delete embeddings for.

        Returns:
            Number of deleted records.
        """
        async with self.async_session() as session:
            result = await session.execute(
                text("DELETE FROM code_embeddings WHERE project_id = :project_id"),
                {"project_id": project_id},
            )
            await session.commit()
            return result.rowcount

    async def create_memory(
        self,
        project_id: str,
        memory_type: str,
        content: dict,
        ticket_id: Optional[str] = None,
        embedding: Optional[np.ndarray] = None,
    ) -> str:
        """Create a memory record.

        Args:
            project_id: Project identifier.
            memory_type: Type of memory.
            content: Memory content.
            ticket_id: Optional ticket identifier.
            embedding: Optional embedding vector.

        Returns:
            ID of the created memory.
        """
        async with self.async_session() as session:
            memory_id = str(uuid4())
            embedding_list = embedding.tolist() if embedding is not None else None

            await session.execute(
                text(
                    """
                INSERT INTO project_memories (id, project_id, ticket_id, memory_type, content, embedding)
                VALUES (:id, :project_id, :ticket_id, :memory_type, :content, :embedding)
            """
                ),
                {
                    "id": memory_id,
                    "project_id": project_id,
                    "ticket_id": ticket_id,
                    "memory_type": memory_type,
                    "content": content,
                    "embedding": embedding_list,
                },
            )
            await session.commit()
            return memory_id

    async def get_memories(
        self,
        project_id: str,
        memory_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[dict]:
        """Get memories for a project.

        Args:
            project_id: Project to get memories for.
            memory_type: Optional filter by memory type.
            limit: Maximum number of results.

        Returns:
            List of memory records.
        """
        async with self.async_session() as session:
            query = """
                SELECT id, project_id, ticket_id, memory_type, content, created_at
                FROM project_memories
                WHERE project_id = :project_id
            """

            params = {"project_id": project_id, "limit": limit}

            if memory_type:
                query += " AND memory_type = :memory_type"
                params["memory_type"] = memory_type

            query += " ORDER BY created_at DESC LIMIT :limit"

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            return [
                {
                    "id": str(row[0]),
                    "project_id": str(row[1]),
                    "ticket_id": str(row[2]) if row[2] else None,
                    "memory_type": row[3],
                    "content": row[4],
                    "created_at": row[5],
                }
                for row in rows
            ]

    async def get_learned_patterns(
        self, project_id: str, pattern_type: Optional[str] = None
    ) -> List[dict]:
        """Get learned patterns for a project.

        Args:
            project_id: Project to get patterns for.
            pattern_type: Optional filter by pattern type.

        Returns:
            List of pattern records.
        """
        async with self.async_session() as session:
            query = """
                SELECT id, pattern_type, pattern_content, success_count, failure_count, last_used_at, created_at
                FROM learned_patterns
                WHERE project_id = :project_id
            """

            params = {"project_id": project_id}

            if pattern_type:
                query += " AND pattern_type = :pattern_type"
                params["pattern_type"] = pattern_type

            query += " ORDER BY success_count DESC LIMIT 50"

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            return [
                {
                    "id": str(row[0]),
                    "pattern_type": row[1],
                    "pattern_content": row[2],
                    "success_count": row[3],
                    "failure_count": row[4],
                    "last_used_at": row[5],
                    "created_at": row[6],
                }
                for row in rows
            ]
