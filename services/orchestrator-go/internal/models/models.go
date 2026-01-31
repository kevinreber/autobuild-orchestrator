package models

import (
	"time"
)

// JobPriority represents the priority level of a job
type JobPriority int

const (
	PriorityLow JobPriority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)

// JobStatus represents the current status of a job
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusQueued     JobStatus = "queued"
	JobStatusDispatched JobStatus = "dispatched"
	JobStatusRunning    JobStatus = "running"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusCancelled  JobStatus = "cancelled"
)

// Job represents an agent execution job
type Job struct {
	ID           string      `json:"id"`
	TicketID     string      `json:"ticket_id"`
	ProjectID    string      `json:"project_id"`
	Priority     JobPriority `json:"priority"`
	Status       JobStatus   `json:"status"`
	WorktreeID   string      `json:"worktree_id,omitempty"`
	WorkerID     string      `json:"worker_id,omitempty"`
	Prompt       string      `json:"prompt"`
	BranchName   string      `json:"branch_name"`
	BaseBranch   string      `json:"base_branch"`
	CallbackURL  string      `json:"callback_url"`
	CallbackSecret string    `json:"callback_secret,omitempty"`
	RetryCount   int         `json:"retry_count"`
	ErrorMessage string      `json:"error_message,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
	DispatchedAt *time.Time  `json:"dispatched_at,omitempty"`
	StartedAt    *time.Time  `json:"started_at,omitempty"`
	CompletedAt  *time.Time  `json:"completed_at,omitempty"`
}

// JobResult represents the result of a completed job
type JobResult struct {
	JobID      string    `json:"job_id"`
	TicketID   string    `json:"ticket_id"`
	Status     string    `json:"status"`
	PRUrl      string    `json:"pr_url,omitempty"`
	PRNumber   int       `json:"pr_number,omitempty"`
	QAPassed   bool      `json:"qa_passed"`
	RunID      string    `json:"run_id,omitempty"`
	Error      string    `json:"error,omitempty"`
	ReceivedAt time.Time `json:"received_at"`
}

// WorktreeStatus represents the status of a worktree
type WorktreeStatus string

const (
	WorktreeStatusActive   WorktreeStatus = "active"
	WorktreeStatusMerging  WorktreeStatus = "merging"
	WorktreeStatusCleanup  WorktreeStatus = "cleanup"
	WorktreeStatusDeleted  WorktreeStatus = "deleted"
)

// Worktree represents a git worktree
type Worktree struct {
	ID         string         `json:"id"`
	ProjectID  string         `json:"project_id"`
	TicketID   string         `json:"ticket_id,omitempty"`
	Path       string         `json:"path"`
	BranchName string         `json:"branch_name"`
	Status     WorktreeStatus `json:"status"`
	CreatedAt  time.Time      `json:"created_at"`
	LastUsedAt time.Time      `json:"last_used_at"`
	CleanupAt  *time.Time     `json:"cleanup_at,omitempty"`
}

// QueueStats represents queue statistics
type QueueStats struct {
	TotalJobs      int            `json:"total_jobs"`
	PendingJobs    int            `json:"pending_jobs"`
	RunningJobs    int            `json:"running_jobs"`
	CompletedJobs  int            `json:"completed_jobs"`
	FailedJobs     int            `json:"failed_jobs"`
	JobsByProject  map[string]int `json:"jobs_by_project"`
	ActiveWorkers  int            `json:"active_workers"`
	MaxWorkers     int            `json:"max_workers"`
}

// CreateJobRequest represents a request to create a new job
type CreateJobRequest struct {
	TicketID       string      `json:"ticket_id"`
	ProjectID      string      `json:"project_id"`
	Priority       JobPriority `json:"priority"`
	Prompt         string      `json:"prompt"`
	TicketTitle    string      `json:"ticket_title"`
	TicketDesc     string      `json:"ticket_description"`
	BaseBranch     string      `json:"base_branch"`
	RepoFullName   string      `json:"repo_full_name"`
	CallbackURL    string      `json:"callback_url"`
	CallbackSecret string      `json:"callback_secret"`
}

// CreateJobResponse represents the response after creating a job
type CreateJobResponse struct {
	Job      *Job   `json:"job"`
	Position int    `json:"position"`
	Message  string `json:"message"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"`
	Queue     QueueStats        `json:"queue"`
	Worktrees WorktreeStats     `json:"worktrees"`
}

// WorktreeStats represents worktree statistics
type WorktreeStats struct {
	Active    int `json:"active"`
	MaxActive int `json:"max_active"`
}
