"""Embedding generation service."""

import logging
from typing import List

import numpy as np
import tiktoken
from sentence_transformers import SentenceTransformer

from src.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text embeddings."""

    def __init__(self, model_name: str | None = None):
        """Initialize the embedding service.

        Args:
            model_name: Name of the sentence-transformers model to use.
        """
        self.model_name = model_name or settings.embedding_model
        self._model: SentenceTransformer | None = None
        self._tokenizer = tiktoken.get_encoding("cl100k_base")
        self.max_tokens = settings.max_chunk_size
        self.overlap = settings.chunk_overlap

    @property
    def model(self) -> SentenceTransformer:
        """Lazy-load the embedding model."""
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed(self, text: str) -> np.ndarray:
        """Generate embedding for a single text.

        Args:
            text: Text to embed.

        Returns:
            Embedding vector as numpy array.
        """
        return self.model.encode(text, normalize_embeddings=True)

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed.

        Returns:
            Array of embedding vectors.
        """
        return self.model.encode(texts, normalize_embeddings=True)

    def count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text.

        Args:
            text: Text to count tokens for.

        Returns:
            Number of tokens.
        """
        return len(self._tokenizer.encode(text))

    def chunk_text(self, text: str) -> List[str]:
        """Split text into chunks with overlap.

        Args:
            text: Text to split.

        Returns:
            List of text chunks.
        """
        tokens = self._tokenizer.encode(text)
        chunks = []

        for i in range(0, len(tokens), self.max_tokens - self.overlap):
            chunk_tokens = tokens[i : i + self.max_tokens]
            chunk_text = self._tokenizer.decode(chunk_tokens)
            chunks.append(chunk_text)

        return chunks

    def chunk_code(self, code: str, language: str | None = None) -> List[dict]:
        """Smart chunking for code files.

        Tries to chunk at logical boundaries (functions, classes) when possible.

        Args:
            code: Source code to chunk.
            language: Programming language (for smarter parsing).

        Returns:
            List of chunks with metadata.
        """
        # For now, use simple token-based chunking
        # TODO: Implement AST-aware chunking using tree-sitter
        chunks = self.chunk_text(code)

        return [
            {
                "content": chunk,
                "index": i,
                "language": language,
            }
            for i, chunk in enumerate(chunks)
        ]


# Global instance
embedding_service = EmbeddingService()
