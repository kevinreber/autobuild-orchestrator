/**
 * Client for the Python Memory & Insights service
 *
 * Handles communication with the memory service for codebase indexing,
 * semantic search, context retrieval, and insights.
 */

const MEMORY_SERVICE_URL = process.env.MEMORY_SERVICE_URL || "http://localhost:8000";

export interface IndexFilesRequest {
  project_id: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface IndexResponse {
  project_id: string;
  files_indexed: number;
  chunks_created: number;
  status: string;
}

export interface SearchRequest {
  project_id: string;
  query: string;
  max_results?: number;
  file_filter?: string;
  min_similarity?: number;
}

export interface SearchResult {
  file_path: string;
  content: string;
  similarity: number;
  chunk_index: number;
  language?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total_results: number;
}

export interface ContextRequest {
  project_id: string;
  task_description: string;
  max_tokens?: number;
  include_patterns?: boolean;
}

export interface ContextResponse {
  context: string;
  sources: string[];
  patterns: Array<{
    pattern_type: string;
    pattern_content: unknown;
    success_count: number;
  }>;
}

export interface CreateMemoryRequest {
  project_id: string;
  ticket_id?: string;
  memory_type: "execution_success" | "pattern" | "insight" | "feedback";
  content: Record<string, unknown>;
}

export interface Memory {
  id: string;
  project_id: string;
  ticket_id?: string;
  memory_type: string;
  content: Record<string, unknown>;
  created_at: string;
}

export interface ChatRequest {
  project_id: string;
  message: string;
  conversation_history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatResponse {
  response: string;
  sources: string[];
}

/**
 * Index files in the memory service
 */
export async function indexFiles(request: IndexFilesRequest): Promise<IndexResponse> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/index/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Failed to index files: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete all embeddings for a project
 */
export async function deleteIndex(projectId: string): Promise<void> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/index/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete index: ${response.status}`);
  }
}

/**
 * Perform semantic search over indexed code
 */
export async function searchCode(request: SearchRequest): Promise<SearchResponse> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get relevant context for a task
 */
export async function getContext(request: ContextRequest): Promise<ContextResponse> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/context`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to get context: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a memory record
 */
export async function createMemory(request: CreateMemoryRequest): Promise<Memory> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to create memory: ${response.status}`);
  }

  return response.json();
}

/**
 * Get memories for a project
 */
export async function getMemories(
  projectId: string,
  memoryType?: string,
  limit?: number
): Promise<{ memories: Memory[]; total: number }> {
  const params = new URLSearchParams();
  if (memoryType) params.set("memory_type", memoryType);
  if (limit) params.set("limit", limit.toString());

  const url = `${MEMORY_SERVICE_URL}/api/v1/memory/${projectId}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get memories: ${response.status}`);
  }

  return response.json();
}

/**
 * Chat with the codebase
 */
export async function chatWithCodebase(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/insights/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Chat failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get learned patterns for a project
 */
export async function getPatterns(projectId: string): Promise<{
  patterns: Array<{
    id: string;
    pattern_type: string;
    pattern_content: unknown;
    success_count: number;
    failure_count: number;
    last_used_at: string;
  }>;
  project_id: string;
}> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/api/v1/insights/patterns/${projectId}`);

  if (!response.ok) {
    throw new Error(`Failed to get patterns: ${response.status}`);
  }

  return response.json();
}

/**
 * Check memory service health
 */
export async function checkHealth(): Promise<{
  status: string;
  version: string;
  service: string;
}> {
  const response = await fetch(`${MEMORY_SERVICE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Memory service health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if memory service is available
 */
export async function isMemoryServiceAvailable(): Promise<boolean> {
  try {
    const health = await checkHealth();
    return health.status === "healthy";
  } catch {
    return false;
  }
}
