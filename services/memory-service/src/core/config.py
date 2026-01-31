"""Configuration settings for the Memory Service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/autobuild"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # AI/ML
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Indexing
    max_chunk_size: int = 512
    chunk_overlap: int = 50

    # Cache
    cache_ttl: int = 3600  # 1 hour

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
