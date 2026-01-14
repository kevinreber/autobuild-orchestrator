/**
 * Client for the Go Agent Orchestrator service
 *
 * Handles communication with the orchestrator for job submission,
 * status monitoring, and queue management.
 */

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8080";

export interface CreateJobRequest {
  ticket_id: string;
  project_id: string;
  priority: number;
  prompt: string;
  ticket_title: string;
  ticket_description: string;
  base_branch: string;
  repo_full_name: string;
  callback_url: string;
  callback_secret: string;
}

export interface Job {
  id: string;
  ticket_id: string;
  project_id: string;
  priority: number;
  status: "pending" | "queued" | "dispatched" | "running" | "completed" | "failed" | "cancelled";
  worktree_id?: string;
  worker_id?: string;
  prompt: string;
  branch_name: string;
  base_branch: string;
  callback_url: string;
  retry_count: number;
  error_message?: string;
  created_at: string;
  dispatched_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface CreateJobResponse {
  job: Job;
  position: number;
  message: string;
}

export interface QueueStats {
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  jobs_by_project: Record<string, number>;
  active_workers: number;
  max_workers: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: string;
  queue: QueueStats;
  worktrees: {
    active: number;
    max_active: number;
  };
}

/**
 * Submit a new job to the orchestrator
 */
export async function submitJob(request: CreateJobRequest): Promise<CreateJobResponse> {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to submit job: ${response.status}`);
  }

  return response.json();
}

/**
 * Get job status by ID
 */
export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/jobs/${jobId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Job not found");
    }
    throw new Error(`Failed to get job: ${response.status}`);
  }

  return response.json();
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/jobs/${jobId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Failed to cancel job: ${response.status}`);
  }
}

/**
 * Get queue status and statistics
 */
export async function getQueueStatus(): Promise<QueueStats> {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/queue`);

  if (!response.ok) {
    throw new Error(`Failed to get queue status: ${response.status}`);
  }

  return response.json();
}

/**
 * Check orchestrator health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/v1/health`);

  if (!response.ok) {
    throw new Error(`Orchestrator health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if orchestrator is available
 */
export async function isOrchestratorAvailable(): Promise<boolean> {
  try {
    const health = await checkHealth();
    return health.status === "healthy";
  } catch {
    return false;
  }
}
