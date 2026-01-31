package queue

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/config"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/models"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/worktree"
	"github.com/rs/zerolog/log"
)

// Manager handles the job queue and worker pool
type Manager struct {
	mu              sync.RWMutex
	cfg             config.QueueConfig
	jobs            map[string]*models.Job
	queue           []*models.Job
	worktreeManager *worktree.Manager
	activeJobs      map[string]int // projectID -> count of active jobs
	workers         chan struct{}  // semaphore for worker pool
	resultChan      chan *models.JobResult
}

// NewManager creates a new queue manager
func NewManager(cfg config.QueueConfig, wm *worktree.Manager) *Manager {
	return &Manager{
		cfg:             cfg,
		jobs:            make(map[string]*models.Job),
		queue:           make([]*models.Job, 0),
		worktreeManager: wm,
		activeJobs:      make(map[string]int),
		workers:         make(chan struct{}, cfg.MaxParallelJobs),
		resultChan:      make(chan *models.JobResult, 100),
	}
}

// Start begins processing jobs from the queue
func (m *Manager) Start(ctx context.Context) {
	log.Info().Int("max_workers", m.cfg.MaxParallelJobs).Msg("Starting queue manager")

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Queue manager shutting down")
			return
		case result := <-m.resultChan:
			m.handleResult(result)
		case <-ticker.C:
			m.processQueue(ctx)
		}
	}
}

// Submit adds a new job to the queue
func (m *Manager) Submit(ctx context.Context, req *models.CreateJobRequest) (*models.CreateJobResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Create job
	job := &models.Job{
		ID:             uuid.New().String(),
		TicketID:       req.TicketID,
		ProjectID:      req.ProjectID,
		Priority:       req.Priority,
		Status:         models.JobStatusPending,
		Prompt:         req.Prompt,
		BranchName:     "autobuild/ticket-" + req.TicketID[:8],
		BaseBranch:     req.BaseBranch,
		CallbackURL:    req.CallbackURL,
		CallbackSecret: req.CallbackSecret,
		CreatedAt:      time.Now(),
	}

	// Add to jobs map
	m.jobs[job.ID] = job

	// Add to priority queue
	m.insertByPriority(job)

	// Calculate position
	position := m.getQueuePosition(job.ID)

	log.Info().
		Str("job_id", job.ID).
		Str("ticket_id", job.TicketID).
		Int("priority", int(job.Priority)).
		Int("position", position).
		Msg("Job submitted to queue")

	return &models.CreateJobResponse{
		Job:      job,
		Position: position,
		Message:  "Job queued successfully",
	}, nil
}

// GetJob retrieves a job by ID
func (m *Manager) GetJob(jobID string) (*models.Job, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	job, ok := m.jobs[jobID]
	return job, ok
}

// CancelJob cancels a pending or running job
func (m *Manager) CancelJob(jobID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[jobID]
	if !ok {
		return ErrJobNotFound
	}

	if job.Status == models.JobStatusCompleted || job.Status == models.JobStatusFailed {
		return ErrJobAlreadyCompleted
	}

	job.Status = models.JobStatusCancelled
	now := time.Now()
	job.CompletedAt = &now

	// Remove from queue if still pending
	m.removeFromQueue(jobID)

	log.Info().Str("job_id", jobID).Msg("Job cancelled")

	return nil
}

// GetStats returns current queue statistics
func (m *Manager) GetStats() *models.QueueStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := &models.QueueStats{
		TotalJobs:     len(m.jobs),
		JobsByProject: make(map[string]int),
		MaxWorkers:    m.cfg.MaxParallelJobs,
	}

	for _, job := range m.jobs {
		switch job.Status {
		case models.JobStatusPending, models.JobStatusQueued:
			stats.PendingJobs++
		case models.JobStatusRunning, models.JobStatusDispatched:
			stats.RunningJobs++
		case models.JobStatusCompleted:
			stats.CompletedJobs++
		case models.JobStatusFailed:
			stats.FailedJobs++
		}
		stats.JobsByProject[job.ProjectID]++
	}

	stats.ActiveWorkers = stats.RunningJobs

	return stats
}

// HandleCallback processes a callback from GitHub Actions
func (m *Manager) HandleCallback(result *models.JobResult) {
	m.resultChan <- result
}

// processQueue dispatches pending jobs to workers
func (m *Manager) processQueue(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := 0; i < len(m.queue); i++ {
		job := m.queue[i]

		if job.Status != models.JobStatusPending {
			continue
		}

		// Check if we can start this job (project parallelism limit)
		if m.activeJobs[job.ProjectID] >= m.getProjectMaxParallel(job.ProjectID) {
			continue
		}

		// Try to acquire a worker slot
		select {
		case m.workers <- struct{}{}:
			// Got a worker, dispatch the job
			job.Status = models.JobStatusDispatched
			now := time.Now()
			job.DispatchedAt = &now
			m.activeJobs[job.ProjectID]++

			go m.executeJob(ctx, job)

		default:
			// No workers available
			return
		}
	}
}

// executeJob runs a job in a goroutine
func (m *Manager) executeJob(ctx context.Context, job *models.Job) {
	defer func() {
		<-m.workers // Release worker slot
	}()

	log.Info().
		Str("job_id", job.ID).
		Str("ticket_id", job.TicketID).
		Msg("Executing job")

	// Create worktree for the job
	wt, err := m.worktreeManager.Create(job.ProjectID, job.TicketID, job.BranchName)
	if err != nil {
		log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to create worktree")
		m.failJob(job, "Failed to create worktree: "+err.Error())
		return
	}

	m.mu.Lock()
	job.WorktreeID = wt.ID
	job.Status = models.JobStatusRunning
	now := time.Now()
	job.StartedAt = &now
	m.mu.Unlock()

	// Dispatch to GitHub Actions
	err = m.dispatchToGitHubActions(ctx, job, wt)
	if err != nil {
		log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to dispatch to GitHub Actions")
		m.failJob(job, "Failed to dispatch: "+err.Error())
		return
	}

	log.Info().
		Str("job_id", job.ID).
		Str("worktree_id", wt.ID).
		Msg("Job dispatched to GitHub Actions")
}

// dispatchToGitHubActions sends a repository_dispatch event
func (m *Manager) dispatchToGitHubActions(ctx context.Context, job *models.Job, wt *models.Worktree) error {
	// TODO: Implement GitHub Actions dispatch
	// This will use the GitHub API to trigger a repository_dispatch event
	// with the job details as the client_payload

	log.Info().
		Str("job_id", job.ID).
		Str("branch", job.BranchName).
		Msg("Would dispatch to GitHub Actions (not yet implemented)")

	return nil
}

// handleResult processes a job result from GitHub Actions
func (m *Manager) handleResult(result *models.JobResult) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Find job by ticket ID
	var job *models.Job
	for _, j := range m.jobs {
		if j.TicketID == result.TicketID {
			job = j
			break
		}
	}

	if job == nil {
		log.Warn().Str("ticket_id", result.TicketID).Msg("Received result for unknown job")
		return
	}

	now := time.Now()
	job.CompletedAt = &now

	if result.Status == "success" {
		job.Status = models.JobStatusCompleted
	} else {
		job.Status = models.JobStatusFailed
		job.ErrorMessage = result.Error
	}

	// Decrement active job count
	m.activeJobs[job.ProjectID]--
	if m.activeJobs[job.ProjectID] < 0 {
		m.activeJobs[job.ProjectID] = 0
	}

	// Remove from queue
	m.removeFromQueue(job.ID)

	// Cleanup worktree
	if job.WorktreeID != "" {
		go m.worktreeManager.Delete(job.WorktreeID)
	}

	log.Info().
		Str("job_id", job.ID).
		Str("status", string(job.Status)).
		Str("pr_url", result.PRUrl).
		Msg("Job completed")
}

// failJob marks a job as failed
func (m *Manager) failJob(job *models.Job, errorMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	job.Status = models.JobStatusFailed
	job.ErrorMessage = errorMsg
	job.CompletedAt = &now

	m.activeJobs[job.ProjectID]--
	if m.activeJobs[job.ProjectID] < 0 {
		m.activeJobs[job.ProjectID] = 0
	}

	m.removeFromQueue(job.ID)
}

// insertByPriority inserts a job into the queue sorted by priority
func (m *Manager) insertByPriority(job *models.Job) {
	// Find insertion point
	insertIdx := len(m.queue)
	for i, j := range m.queue {
		if job.Priority > j.Priority {
			insertIdx = i
			break
		}
	}

	// Insert at position
	m.queue = append(m.queue[:insertIdx], append([]*models.Job{job}, m.queue[insertIdx:]...)...)
}

// removeFromQueue removes a job from the queue
func (m *Manager) removeFromQueue(jobID string) {
	for i, j := range m.queue {
		if j.ID == jobID {
			m.queue = append(m.queue[:i], m.queue[i+1:]...)
			return
		}
	}
}

// getQueuePosition returns the position of a job in the queue
func (m *Manager) getQueuePosition(jobID string) int {
	for i, j := range m.queue {
		if j.ID == jobID {
			return i + 1
		}
	}
	return -1
}

// getProjectMaxParallel returns the max parallel jobs for a project
func (m *Manager) getProjectMaxParallel(projectID string) int {
	// TODO: Fetch from database
	return 3 // Default
}

// Errors
var (
	ErrJobNotFound        = NewQueueError("job not found")
	ErrJobAlreadyCompleted = NewQueueError("job already completed")
)

type QueueError struct {
	message string
}

func NewQueueError(message string) *QueueError {
	return &QueueError{message: message}
}

func (e *QueueError) Error() string {
	return e.message
}
