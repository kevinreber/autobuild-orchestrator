# AutoBuild Orchestrator - Feature Enhancement Implementation Plan

This document outlines the implementation plan for adopting key features inspired by [Auto-Claude](https://github.com/AndyMik90/Auto-Claude), including new microservices architecture.

## Executive Summary

We're enhancing AutoBuild Orchestrator with:
1. **Parallel Agent Execution** - Multiple tickets processed simultaneously
2. **Git Worktree Isolation** - Safe parallel development
3. **QA Pipeline Integration** - Automated testing before PR creation
4. **Memory Layer** - Cross-session learning and codebase insights
5. **AI Merge Resolution** - Intelligent conflict handling

This requires building **two new microservices**:
- **Agent Orchestrator Service** (Go) - High-performance parallel agent management
- **Memory & Insights Service** (Python) - Embeddings, RAG, and codebase analysis

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AutoBuild Platform                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐     ┌──────────────────────┐                      │
│  │   Web Application    │     │   Agent Orchestrator │                      │
│  │   (React Router)     │────▶│       (Golang)       │                      │
│  │                      │     │                      │                      │
│  │  - Dashboard UI      │     │  - Parallel dispatch │                      │
│  │  - Kanban Board      │     │  - Worktree manager  │                      │
│  │  - OAuth/Auth        │     │  - Queue management  │                      │
│  │  - API endpoints     │     │  - Health monitoring │                      │
│  └──────────┬───────────┘     └──────────┬───────────┘                      │
│             │                            │                                   │
│             │                            ▼                                   │
│             │                 ┌──────────────────────┐                      │
│             │                 │   GitHub Actions     │                      │
│             │                 │   (Agent Runners)    │                      │
│             │                 │                      │                      │
│             │                 │  - Claude Code CLI   │                      │
│             │                 │  - Git worktrees     │                      │
│             │                 │  - QA validation     │                      │
│             │                 └──────────┬───────────┘                      │
│             │                            │                                   │
│             ▼                            ▼                                   │
│  ┌──────────────────────┐     ┌──────────────────────┐                      │
│  │   PostgreSQL         │     │   Memory Service     │                      │
│  │   (Supabase)         │     │      (Python)        │                      │
│  │                      │     │                      │                      │
│  │  - Users, Projects   │     │  - Vector embeddings │                      │
│  │  - Tickets, Queue    │     │  - Codebase indexing │                      │
│  │  - Executions        │     │  - RAG retrieval     │                      │
│  │  - Memory refs       │     │  - Pattern learning  │                      │
│  └──────────────────────┘     └──────────────────────┘                      │
│                                          │                                   │
│                                          ▼                                   │
│                               ┌──────────────────────┐                      │
│                               │   Vector Database    │                      │
│                               │   (pgvector/Pinecone)│                      │
│                               └──────────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Services

### 1. Agent Orchestrator Service (Go)

**Why Go?**
- Excellent concurrency primitives (goroutines, channels)
- Low memory footprint for running many parallel operations
- Strong typing and compile-time safety
- Fast startup time for serverless/container deployments
- Native HTTP/gRPC support

**Repository**: `autobuild-orchestrator-go` (new repo)

**Responsibilities**:
- Managing parallel agent execution queue
- Git worktree lifecycle management
- Dispatching jobs to GitHub Actions
- Handling callbacks and status updates
- Rate limiting and resource management
- Health monitoring and auto-recovery

**Key Components**:

```go
// Directory Structure
orchestrator/
├── cmd/
│   └── orchestrator/
│       └── main.go              // Entry point
├── internal/
│   ├── api/
│   │   ├── handlers.go          // HTTP handlers
│   │   ├── middleware.go        // Auth, logging
│   │   └── routes.go            // Route definitions
│   ├── queue/
│   │   ├── manager.go           // Job queue management
│   │   ├── worker.go            // Worker pool
│   │   └── priority.go          // Priority scheduling
│   ├── worktree/
│   │   ├── manager.go           // Git worktree operations
│   │   ├── pool.go              // Worktree pooling
│   │   └── cleanup.go           // Cleanup routines
│   ├── github/
│   │   ├── actions.go           // Dispatch to GitHub Actions
│   │   ├── webhook.go           // Webhook handlers
│   │   └── client.go            // GitHub API client
│   ├── agent/
│   │   ├── executor.go          // Agent execution logic
│   │   ├── monitor.go           // Execution monitoring
│   │   └── callback.go          // Result handling
│   └── config/
│       └── config.go            // Configuration
├── pkg/
│   ├── models/                  // Shared data models
│   └── utils/                   // Utility functions
├── Dockerfile
├── docker-compose.yml
└── go.mod
```

**API Endpoints**:

```
POST   /api/v1/jobs              # Submit new agent job
GET    /api/v1/jobs/:id          # Get job status
DELETE /api/v1/jobs/:id          # Cancel job
GET    /api/v1/jobs/:id/logs     # Stream job logs

POST   /api/v1/worktrees         # Create worktree
DELETE /api/v1/worktrees/:id     # Cleanup worktree
GET    /api/v1/worktrees         # List active worktrees

GET    /api/v1/queue             # Queue status
GET    /api/v1/health            # Health check
GET    /api/v1/metrics           # Prometheus metrics
```

**Configuration**:

```yaml
# config.yaml
server:
  port: 8080
  host: 0.0.0.0

queue:
  max_parallel_jobs: 12
  job_timeout: 30m
  retry_attempts: 3
  priority_levels: [critical, high, normal, low]

worktree:
  base_path: /tmp/autobuild-worktrees
  max_active: 20
  cleanup_interval: 5m
  max_age: 2h

github:
  app_id: ${GITHUB_APP_ID}
  installation_id: ${GITHUB_INSTALLATION_ID}
  private_key_path: /secrets/github-app.pem

database:
  url: ${DATABASE_URL}
  max_connections: 25

memory_service:
  url: http://memory-service:8000
  timeout: 30s
```

---

### 2. Memory & Insights Service (Python)

**Why Python?**
- Superior ML/AI ecosystem (transformers, langchain, etc.)
- Excellent embedding model support
- Easy integration with vector databases
- Rich text processing libraries
- Rapid prototyping for AI features

**Repository**: `autobuild-memory-service` (new repo)

**Responsibilities**:
- Codebase indexing and embedding generation
- Semantic search and RAG retrieval
- Pattern learning from successful executions
- Codebase insights and chat interface
- Changelog generation from commits

**Key Components**:

```python
# Directory Structure
memory_service/
├── src/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── routes/
│   │   │   ├── embeddings.py    # Embedding endpoints
│   │   │   ├── search.py        # Search endpoints
│   │   │   ├── insights.py      # Codebase insights
│   │   │   ├── memory.py        # Memory CRUD
│   │   │   └── changelog.py     # Changelog generation
│   │   └── middleware.py
│   ├── core/
│   │   ├── config.py            # Settings
│   │   ├── embeddings.py        # Embedding generation
│   │   ├── indexer.py           # Code indexing
│   │   └── chunker.py           # Smart code chunking
│   ├── services/
│   │   ├── vector_store.py      # Vector DB operations
│   │   ├── rag.py               # RAG retrieval
│   │   ├── memory.py            # Memory management
│   │   ├── patterns.py          # Pattern learning
│   │   └── changelog.py         # Changelog generation
│   ├── models/
│   │   ├── schemas.py           # Pydantic models
│   │   └── database.py          # SQLAlchemy models
│   └── utils/
│       ├── git.py               # Git operations
│       └── parsing.py           # Code parsing
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── pyproject.toml
```

**API Endpoints**:

```
# Embedding & Indexing
POST   /api/v1/index/repository     # Index entire repository
POST   /api/v1/index/files          # Index specific files
DELETE /api/v1/index/:repo_id       # Remove repository index

# Search & Retrieval
POST   /api/v1/search               # Semantic code search
POST   /api/v1/context              # Get relevant context for task

# Memory
POST   /api/v1/memory               # Store memory/insight
GET    /api/v1/memory/:project_id   # Get project memories
DELETE /api/v1/memory/:id           # Delete memory

# Insights
POST   /api/v1/insights/chat        # Chat with codebase
GET    /api/v1/insights/summary     # Get codebase summary
GET    /api/v1/insights/patterns    # Get learned patterns

# Changelog
POST   /api/v1/changelog/generate   # Generate changelog from commits
```

**Dependencies**:

```txt
# requirements.txt
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
sqlalchemy>=2.0.0
asyncpg>=0.29.0

# ML/Embeddings
openai>=1.10.0
anthropic>=0.18.0
tiktoken>=0.5.0
sentence-transformers>=2.3.0

# Vector Store
pgvector>=0.2.0
pinecone-client>=3.0.0  # Optional

# Code Parsing
tree-sitter>=0.20.0
tree-sitter-languages>=1.8.0

# Git
gitpython>=3.1.0

# Utilities
httpx>=0.26.0
redis>=5.0.0
```

---

## Feature Implementation Details

### Phase 1: Parallel Agent Execution

**Database Changes**:

```sql
-- New tables for queue management
CREATE TABLE agent_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id),
    project_id UUID REFERENCES projects(id),
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, dispatched, running, completed, failed
    worktree_id UUID,
    worker_id VARCHAR(100),
    dispatched_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE worktrees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    ticket_id UUID REFERENCES tickets(id),
    path VARCHAR(500) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, merging, cleanup, deleted
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- Add parallel execution settings to projects
ALTER TABLE projects ADD COLUMN max_parallel_agents INTEGER DEFAULT 3;
ALTER TABLE projects ADD COLUMN worktree_enabled BOOLEAN DEFAULT true;
```

**Go Orchestrator - Queue Manager**:

```go
// internal/queue/manager.go
package queue

import (
    "context"
    "sync"
    "time"
)

type JobPriority int

const (
    PriorityLow JobPriority = iota
    PriorityNormal
    PriorityHigh
    PriorityCritical
)

type Job struct {
    ID          string
    TicketID    string
    ProjectID   string
    Priority    JobPriority
    Status      string
    WorktreeID  string
    CreatedAt   time.Time
    StartedAt   *time.Time
}

type QueueManager struct {
    mu            sync.RWMutex
    jobs          map[string]*Job
    priorityQueue *PriorityQueue
    workers       *WorkerPool
    maxParallel   int
    db            *Database
}

func NewQueueManager(maxParallel int, db *Database) *QueueManager {
    qm := &QueueManager{
        jobs:          make(map[string]*Job),
        priorityQueue: NewPriorityQueue(),
        maxParallel:   maxParallel,
        db:            db,
    }
    qm.workers = NewWorkerPool(maxParallel, qm.processJob)
    return qm
}

func (qm *QueueManager) Submit(ctx context.Context, job *Job) error {
    qm.mu.Lock()
    defer qm.mu.Unlock()

    // Check if project has capacity
    activeCount := qm.countActiveJobsForProject(job.ProjectID)
    maxForProject := qm.getProjectMaxParallel(job.ProjectID)

    if activeCount >= maxForProject {
        job.Status = "queued"
    } else {
        job.Status = "pending"
    }

    qm.jobs[job.ID] = job
    qm.priorityQueue.Push(job)

    return qm.db.SaveJob(ctx, job)
}

func (qm *QueueManager) processJob(ctx context.Context, job *Job) error {
    // 1. Create worktree
    worktree, err := qm.createWorktree(ctx, job)
    if err != nil {
        return err
    }
    job.WorktreeID = worktree.ID

    // 2. Dispatch to GitHub Actions
    err = qm.dispatchToGitHubActions(ctx, job, worktree)
    if err != nil {
        return err
    }

    // 3. Update status
    job.Status = "dispatched"
    return qm.db.UpdateJob(ctx, job)
}
```

**GitHub Actions Workflow Update**:

```yaml
# .github/workflows/autobuild-agent-parallel.yml
name: AutoBuild Agent (Parallel)

on:
  repository_dispatch:
    types: [autobuild-ticket-parallel]

permissions:
  contents: write
  pull-requests: write

jobs:
  implement-ticket:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Git Worktree
        run: |
          # Create worktree for isolated development
          WORKTREE_PATH="/tmp/worktree-${{ github.event.client_payload.ticket_id }}"
          git worktree add "$WORKTREE_PATH" -b ${{ github.event.client_payload.branch_name }}
          echo "WORKTREE_PATH=$WORKTREE_PATH" >> $GITHUB_ENV
          cd "$WORKTREE_PATH"

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Get Context from Memory Service
        id: context
        run: |
          # Fetch relevant context from memory service
          CONTEXT=$(curl -s -X POST "${{ github.event.client_payload.memory_service_url }}/api/v1/context" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.MEMORY_SERVICE_TOKEN }}" \
            -d '{
              "project_id": "${{ github.event.client_payload.project_id }}",
              "task_description": "${{ github.event.client_payload.prompt }}",
              "max_tokens": 2000
            }' | jq -r '.context // empty')

          if [ -n "$CONTEXT" ]; then
            echo "MEMORY_CONTEXT<<EOF" >> $GITHUB_ENV
            echo "$CONTEXT" >> $GITHUB_ENV
            echo "EOF" >> $GITHUB_ENV
          fi

      - name: Run Claude Code Agent
        working-directory: ${{ env.WORKTREE_PATH }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Include memory context in prompt if available
          FULL_PROMPT="${{ github.event.client_payload.prompt }}"
          if [ -n "$MEMORY_CONTEXT" ]; then
            FULL_PROMPT="## Relevant Context from Previous Work\n$MEMORY_CONTEXT\n\n## Task\n$FULL_PROMPT"
          fi

          claude -p "$FULL_PROMPT" \
            --allowedTools "Edit,Write,Read,Glob,Grep,Bash" \
            --output-format json \
            --max-turns 50 \
            > claude_output.json 2>&1 || true

      - name: Run QA Validation
        working-directory: ${{ env.WORKTREE_PATH }}
        id: qa
        run: |
          # Detect project type and run appropriate checks
          QA_PASSED=true
          QA_REPORT=""

          # Check for package.json (Node.js project)
          if [ -f "package.json" ]; then
            # Install dependencies
            npm ci 2>/dev/null || npm install 2>/dev/null || true

            # Run linting if available
            if npm run lint --if-present 2>&1 | tee lint_output.txt; then
              QA_REPORT="$QA_REPORT\n✅ Linting passed"
            else
              QA_REPORT="$QA_REPORT\n⚠️ Linting issues found"
            fi

            # Run type checking if available
            if npm run typecheck --if-present 2>&1 | tee typecheck_output.txt; then
              QA_REPORT="$QA_REPORT\n✅ Type checking passed"
            else
              QA_REPORT="$QA_REPORT\n⚠️ Type errors found"
              QA_PASSED=false
            fi

            # Run tests if available
            if npm test --if-present 2>&1 | tee test_output.txt; then
              QA_REPORT="$QA_REPORT\n✅ Tests passed"
            else
              QA_REPORT="$QA_REPORT\n❌ Tests failed"
              QA_PASSED=false
            fi
          fi

          # Check for Python project
          if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
            # Run ruff/flake8 if available
            if command -v ruff &> /dev/null; then
              if ruff check . 2>&1 | tee ruff_output.txt; then
                QA_REPORT="$QA_REPORT\n✅ Ruff linting passed"
              else
                QA_REPORT="$QA_REPORT\n⚠️ Ruff issues found"
              fi
            fi

            # Run pytest if available
            if command -v pytest &> /dev/null; then
              if pytest 2>&1 | tee pytest_output.txt; then
                QA_REPORT="$QA_REPORT\n✅ Pytest passed"
              else
                QA_REPORT="$QA_REPORT\n❌ Pytest failed"
                QA_PASSED=false
              fi
            fi
          fi

          echo "QA_PASSED=$QA_PASSED" >> $GITHUB_ENV
          echo "QA_REPORT<<EOF" >> $GITHUB_ENV
          echo -e "$QA_REPORT" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV

      - name: Commit and Push
        working-directory: ${{ env.WORKTREE_PATH }}
        run: |
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
            echo "HAS_CHANGES=false" >> $GITHUB_ENV
          else
            git commit -m "feat: ${{ github.event.client_payload.ticket_title }}"
            git push origin ${{ github.event.client_payload.branch_name }}
            echo "HAS_CHANGES=true" >> $GITHUB_ENV
          fi

      - name: Create Pull Request
        if: env.HAS_CHANGES == 'true'
        id: create-pr
        uses: actions/github-script@v7
        with:
          script: |
            const qaReport = process.env.QA_REPORT || 'No QA checks configured';
            const qaPassed = process.env.QA_PASSED === 'true';

            const { data: pr } = await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[AutoBuild] ${{ github.event.client_payload.ticket_title }}`,
              body: `## AutoBuild Agent Implementation

### Ticket
**${{ github.event.client_payload.ticket_title }}**

${{ github.event.client_payload.ticket_description }}

### QA Validation
${qaPassed ? '✅ All checks passed' : '⚠️ Some checks need attention'}

${qaReport}

---
*This PR was automatically generated by AutoBuild Agent*`,
              head: '${{ github.event.client_payload.branch_name }}',
              base: '${{ github.event.client_payload.base_branch }}'
            });

            console.log(`Created PR #${pr.number}: ${pr.html_url}`);
            core.setOutput('pr_number', pr.number);
            core.setOutput('pr_url', pr.html_url);

      - name: Store Execution Memory
        if: env.HAS_CHANGES == 'true'
        run: |
          # Store successful patterns in memory service
          curl -X POST "${{ github.event.client_payload.memory_service_url }}/api/v1/memory" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.MEMORY_SERVICE_TOKEN }}" \
            -d '{
              "project_id": "${{ github.event.client_payload.project_id }}",
              "ticket_id": "${{ github.event.client_payload.ticket_id }}",
              "type": "execution_success",
              "content": {
                "task": "${{ github.event.client_payload.prompt }}",
                "files_modified": [],
                "patterns_used": []
              }
            }' || echo "Memory storage failed, continuing..."

      - name: Cleanup Worktree
        if: always()
        run: |
          cd ${{ github.workspace }}
          git worktree remove "${{ env.WORKTREE_PATH }}" --force || true

      - name: Report Results
        if: always()
        run: |
          STATUS="success"
          if [ "${{ env.HAS_CHANGES }}" != "true" ]; then
            STATUS="no_changes"
          elif [ "${{ env.QA_PASSED }}" != "true" ]; then
            STATUS="qa_failed"
          fi

          curl -X POST "${{ github.event.client_payload.callback_url }}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ github.event.client_payload.callback_secret }}" \
            -d "{
              \"ticket_id\": \"${{ github.event.client_payload.ticket_id }}\",
              \"status\": \"$STATUS\",
              \"pr_url\": \"${{ steps.create-pr.outputs.pr_url }}\",
              \"pr_number\": \"${{ steps.create-pr.outputs.pr_number }}\",
              \"qa_passed\": ${{ env.QA_PASSED }},
              \"run_id\": \"${{ github.run_id }}\"
            }" || echo "Callback failed"
```

---

### Phase 2: Memory & Insights Service

**Python Memory Service Core**:

```python
# src/core/embeddings.py
from sentence_transformers import SentenceTransformer
import tiktoken
from typing import List, Optional
import numpy as np

class EmbeddingService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.max_tokens = 512

    def embed(self, text: str) -> np.ndarray:
        """Generate embedding for text."""
        return self.model.encode(text, normalize_embeddings=True)

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for multiple texts."""
        return self.model.encode(texts, normalize_embeddings=True)

    def chunk_code(self, code: str, overlap: int = 50) -> List[str]:
        """Smart chunking for code files."""
        tokens = self.tokenizer.encode(code)
        chunks = []

        for i in range(0, len(tokens), self.max_tokens - overlap):
            chunk_tokens = tokens[i:i + self.max_tokens]
            chunks.append(self.tokenizer.decode(chunk_tokens))

        return chunks
```

```python
# src/services/rag.py
from typing import List, Dict, Any, Optional
from pgvector.asyncpg import register_vector
import asyncpg

class RAGService:
    def __init__(self, db_pool: asyncpg.Pool, embedding_service: EmbeddingService):
        self.db = db_pool
        self.embeddings = embedding_service

    async def get_relevant_context(
        self,
        project_id: str,
        query: str,
        max_results: int = 5,
        max_tokens: int = 2000
    ) -> str:
        """Retrieve relevant code context for a task."""
        query_embedding = self.embeddings.embed(query)

        # Search for similar code chunks
        results = await self.db.fetch("""
            SELECT
                file_path,
                content,
                1 - (embedding <=> $1) as similarity
            FROM code_embeddings
            WHERE project_id = $2
            ORDER BY embedding <=> $1
            LIMIT $3
        """, query_embedding, project_id, max_results)

        # Format context
        context_parts = []
        total_tokens = 0

        for row in results:
            chunk = f"## {row['file_path']}\n```\n{row['content']}\n```\n"
            chunk_tokens = len(self.embeddings.tokenizer.encode(chunk))

            if total_tokens + chunk_tokens > max_tokens:
                break

            context_parts.append(chunk)
            total_tokens += chunk_tokens

        return "\n".join(context_parts)

    async def get_learned_patterns(
        self,
        project_id: str,
        task_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get patterns learned from previous successful executions."""
        query = """
            SELECT
                pattern_type,
                pattern_content,
                success_count,
                last_used_at
            FROM learned_patterns
            WHERE project_id = $1
        """
        params = [project_id]

        if task_type:
            query += " AND pattern_type = $2"
            params.append(task_type)

        query += " ORDER BY success_count DESC LIMIT 10"

        return await self.db.fetch(query, *params)
```

```python
# src/api/routes/insights.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import anthropic

router = APIRouter(prefix="/insights", tags=["insights"])

class ChatRequest(BaseModel):
    project_id: str
    message: str
    conversation_history: Optional[list] = None

class ChatResponse(BaseModel):
    response: str
    sources: list[str]

@router.post("/chat", response_model=ChatResponse)
async def chat_with_codebase(
    request: ChatRequest,
    rag_service: RAGService = Depends(get_rag_service),
    anthropic_client: anthropic.Anthropic = Depends(get_anthropic_client)
):
    """Chat with the codebase using RAG."""

    # Get relevant context
    context = await rag_service.get_relevant_context(
        project_id=request.project_id,
        query=request.message,
        max_results=10,
        max_tokens=4000
    )

    # Build prompt with context
    system_prompt = f"""You are a helpful assistant that answers questions about a codebase.
Use the following code context to answer the user's question accurately.
If the context doesn't contain enough information, say so.

## Codebase Context
{context}
"""

    messages = request.conversation_history or []
    messages.append({"role": "user", "content": request.message})

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=system_prompt,
        messages=messages
    )

    # Extract sources from context
    sources = [line.split("## ")[1].split("\n")[0]
               for line in context.split("## ") if line.strip()]

    return ChatResponse(
        response=response.content[0].text,
        sources=sources
    )
```

---

### Phase 3: AI Merge Conflict Resolution

**Go Orchestrator - Merge Handler**:

```go
// internal/merge/resolver.go
package merge

import (
    "context"
    "fmt"
    "strings"

    "github.com/anthropics/anthropic-go"
)

type ConflictResolver struct {
    anthropicClient *anthropic.Client
    gitClient       *GitClient
}

type MergeConflict struct {
    FilePath    string
    OurChanges  string
    TheirChanges string
    BaseContent string
}

func (cr *ConflictResolver) ResolveConflicts(
    ctx context.Context,
    conflicts []MergeConflict,
    ticketContext string,
) (map[string]string, error) {
    resolved := make(map[string]string)

    for _, conflict := range conflicts {
        resolution, err := cr.resolveConflict(ctx, conflict, ticketContext)
        if err != nil {
            return nil, fmt.Errorf("failed to resolve %s: %w", conflict.FilePath, err)
        }
        resolved[conflict.FilePath] = resolution
    }

    return resolved, nil
}

func (cr *ConflictResolver) resolveConflict(
    ctx context.Context,
    conflict MergeConflict,
    ticketContext string,
) (string, error) {
    prompt := fmt.Sprintf(`You are resolving a git merge conflict.

## Ticket Context
%s

## File: %s

### Base Version (common ancestor)
%s

### Our Changes (feature branch)
%s

### Their Changes (target branch)
%s

Please provide the resolved file content that:
1. Preserves the intent of both changes where possible
2. Prioritizes our changes when they conflict with their changes
3. Ensures the code is syntactically correct
4. Maintains consistency with the rest of the codebase

Output ONLY the resolved file content, no explanations.`,
        ticketContext,
        conflict.FilePath,
        conflict.BaseContent,
        conflict.OurChanges,
        conflict.TheirChanges,
    )

    resp, err := cr.anthropicClient.Messages.Create(ctx, &anthropic.MessagesRequest{
        Model:     "claude-sonnet-4-20250514",
        MaxTokens: 8000,
        Messages: []anthropic.Message{
            {Role: "user", Content: prompt},
        },
    })
    if err != nil {
        return "", err
    }

    return resp.Content[0].Text, nil
}
```

---

## Database Schema (Complete)

```sql
-- Full schema for all new features

-- Queue management
CREATE TABLE agent_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    worktree_id UUID,
    worker_id VARCHAR(100),
    dispatched_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_queue_status ON agent_queue(status);
CREATE INDEX idx_agent_queue_project ON agent_queue(project_id);
CREATE INDEX idx_agent_queue_priority ON agent_queue(priority DESC, created_at ASC);

-- Worktree tracking
CREATE TABLE worktrees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    path VARCHAR(500) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW(),
    cleanup_at TIMESTAMP
);

CREATE INDEX idx_worktrees_status ON worktrees(status);
CREATE INDEX idx_worktrees_project ON worktrees(project_id);

-- Code embeddings for RAG
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE code_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    embedding vector(384) NOT NULL,  -- Dimension depends on model
    chunk_index INTEGER DEFAULT 0,
    language VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_code_embeddings_project ON code_embeddings(project_id);
CREATE INDEX idx_code_embeddings_hash ON code_embeddings(content_hash);
CREATE INDEX idx_code_embeddings_vector ON code_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Memory/insights storage
CREATE TABLE project_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    memory_type VARCHAR(50) NOT NULL,  -- execution_success, pattern, insight, feedback
    content JSONB NOT NULL,
    embedding vector(384),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_memories_project ON project_memories(project_id);
CREATE INDEX idx_project_memories_type ON project_memories(memory_type);

-- Learned patterns
CREATE TABLE learned_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    pattern_type VARCHAR(100) NOT NULL,  -- file_structure, naming, error_handling, etc.
    pattern_content JSONB NOT NULL,
    success_count INTEGER DEFAULT 1,
    failure_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learned_patterns_project ON learned_patterns(project_id);
CREATE INDEX idx_learned_patterns_type ON learned_patterns(pattern_type);

-- Project settings for new features
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_parallel_agents INTEGER DEFAULT 3;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS worktree_enabled BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS qa_enabled BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS index_status VARCHAR(20);
```

---

## Deployment Architecture

```yaml
# docker-compose.yml (Development)
version: '3.8'

services:
  web:
    build: ./autobuild-orchestrator
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/autobuild
      - ORCHESTRATOR_URL=http://orchestrator:8080
      - MEMORY_SERVICE_URL=http://memory:8000
    depends_on:
      - db
      - orchestrator
      - memory

  orchestrator:
    build: ./autobuild-orchestrator-go
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/autobuild
      - MEMORY_SERVICE_URL=http://memory:8000
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_PRIVATE_KEY=${GITHUB_PRIVATE_KEY}
    depends_on:
      - db
      - memory

  memory:
    build: ./autobuild-memory-service
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/autobuild
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - db

  db:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=autobuild
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Go orchestrator project structure
- [ ] Set up Python memory service project structure
- [ ] Create database migrations for new tables
- [ ] Implement basic queue management in Go
- [ ] Implement basic embedding service in Python
- [ ] Update GitHub Actions workflow for worktrees

### Phase 2: Parallel Execution (Weeks 3-4)
- [ ] Implement worker pool in Go orchestrator
- [ ] Add worktree lifecycle management
- [ ] Update web app to support multiple in-progress tickets
- [ ] Add project-level parallel agent settings
- [ ] Implement job status monitoring and callbacks

### Phase 3: QA Pipeline (Week 5)
- [ ] Add QA validation step to GitHub Actions
- [ ] Implement project type detection
- [ ] Add lint/test/typecheck runners
- [ ] Update PR creation with QA report
- [ ] Add QA failure handling and retry logic

### Phase 4: Memory & Insights (Weeks 6-7)
- [ ] Implement repository indexing in Python
- [ ] Add RAG context retrieval
- [ ] Implement pattern learning from executions
- [ ] Add codebase chat endpoint
- [ ] Integrate memory context into agent prompts

### Phase 5: AI Merge Resolution (Week 8)
- [ ] Implement conflict detection in Go
- [ ] Add AI-powered conflict resolution
- [ ] Implement merge workflow
- [ ] Add conflict resolution UI feedback

### Phase 6: Polish & Integration (Week 9)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Monitoring and alerting setup

---

## API Integration Points

### Web App → Go Orchestrator
```typescript
// app/lib/orchestrator.client.ts
export async function submitAgentJob(ticket: Ticket, project: Project) {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      ticket_id: ticket.id,
      project_id: project.id,
      priority: ticket.priority,
      prompt: buildPrompt(ticket),
    }),
  });
  return response.json();
}

export async function getJobStatus(jobId: string) {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/jobs/${jobId}`);
  return response.json();
}
```

### Go Orchestrator → Memory Service
```go
// internal/memory/client.go
func (c *MemoryClient) GetContext(ctx context.Context, projectID, taskDescription string) (string, error) {
    resp, err := c.httpClient.Post(
        c.baseURL + "/api/v1/context",
        "application/json",
        bytes.NewBuffer([]byte(fmt.Sprintf(`{
            "project_id": "%s",
            "task_description": "%s",
            "max_tokens": 2000
        }`, projectID, taskDescription))),
    )
    // ...
}
```

### GitHub Actions → Memory Service
```yaml
# In workflow
- name: Store Execution Memory
  run: |
    curl -X POST "$MEMORY_SERVICE_URL/api/v1/memory" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"project_id": "...", "type": "execution_success", ...}'
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Parallel tickets per project | 1 | 3-12 |
| Average ticket completion time | 15 min | 10 min |
| PR quality (tests passing) | ~70% | >90% |
| Merge conflict resolution | Manual | 80% auto |
| Context relevance (agent accuracy) | N/A | Measured |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Go service complexity | Start with minimal MVP, iterate |
| Embedding quality | Test multiple models, use proven SentenceTransformers |
| GitHub API rate limits | Implement caching, use GitHub App for higher limits |
| Memory service latency | Add Redis caching for frequent queries |
| Worktree disk usage | Implement aggressive cleanup, set limits |

---

## Next Steps

1. **Create new repositories**:
   - `autobuild-orchestrator-go`
   - `autobuild-memory-service`

2. **Set up CI/CD** for new services

3. **Begin Phase 1** implementation

4. **Update documentation** and architecture diagrams
