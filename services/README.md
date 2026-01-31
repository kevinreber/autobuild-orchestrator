# AutoBuild Orchestrator - Microservices

This directory contains the microservices that power the AutoBuild Orchestrator platform.

## Services Overview

### 1. Agent Orchestrator (Go)

**Path:** `./orchestrator-go`

A high-performance Go service responsible for:
- Managing parallel agent execution (up to 12 concurrent jobs)
- Git worktree lifecycle management for isolated development
- Job queue with priority scheduling
- Dispatching jobs to GitHub Actions
- Handling callbacks and status updates

**Key Features:**
- Goroutine-based worker pool for concurrency
- Priority queue for job scheduling
- Automatic worktree cleanup
- Health monitoring and metrics

**API Endpoints:**
```
POST   /api/v1/jobs              # Submit new job
GET    /api/v1/jobs/:id          # Get job status
DELETE /api/v1/jobs/:id          # Cancel job
GET    /api/v1/queue             # Queue status
GET    /api/v1/worktrees         # List worktrees
GET    /api/v1/health            # Health check
GET    /api/v1/metrics           # Prometheus metrics
POST   /api/v1/callback          # GitHub Actions callback
```

### 2. Memory & Insights Service (Python)

**Path:** `./memory-service`

A Python FastAPI service for AI-powered features:
- Codebase indexing and embedding generation
- Semantic code search using pgvector
- RAG (Retrieval Augmented Generation) for context
- Memory management for cross-session learning
- Codebase insights and chat interface

**Key Features:**
- Sentence-transformers for embeddings
- pgvector for similarity search
- Pattern learning from successful executions
- Claude-powered codebase chat

**API Endpoints:**
```
POST   /api/v1/index/files       # Index code files
DELETE /api/v1/index/:project_id # Delete project index
POST   /api/v1/search            # Semantic search
POST   /api/v1/context           # Get task context
POST   /api/v1/memory            # Create memory
GET    /api/v1/memory/:project_id # Get memories
POST   /api/v1/insights/chat     # Chat with codebase
GET    /api/v1/insights/patterns # Get learned patterns
POST   /api/v1/changelog/generate # Generate changelog
```

## Running Locally

### Using Docker Compose (Recommended)

From the project root:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Running Services Individually

**Agent Orchestrator:**
```bash
cd orchestrator-go
cp .env.example .env
# Edit .env with your settings
go run ./cmd/orchestrator
```

**Memory Service:**
```bash
cd memory-service
cp .env.example .env
# Edit .env with your settings
pip install -r requirements.txt
uvicorn src.api.main:app --reload
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│    Web App          │     │  Agent Orchestrator │
│  (React Router)     │────▶│       (Go)          │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │   GitHub Actions    │
                            │   (Agent Runners)   │
                            └──────────┬──────────┘
                                       │
                                       ▼
┌─────────────────────┐     ┌─────────────────────┐
│    PostgreSQL       │◀────│   Memory Service    │
│   (with pgvector)   │     │      (Python)       │
└─────────────────────┘     └─────────────────────┘
```

## Configuration

### Environment Variables

See `.env.example` files in each service directory for required configuration.

### Database

Both services share the same PostgreSQL database with pgvector extension. The database schema is managed by migrations in the main app.

## Development

### Go Service

```bash
cd orchestrator-go

# Install dependencies
go mod download

# Run with hot reload (requires air)
air

# Run tests
go test ./...

# Build
go build -o orchestrator ./cmd/orchestrator
```

### Python Service

```bash
cd memory-service

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn src.api.main:app --reload

# Run tests
pytest

# Type checking
mypy src

# Linting
ruff check src
```

## Health Checks

Both services expose health endpoints:
- Orchestrator: `GET /api/v1/health`
- Memory Service: `GET /health`
