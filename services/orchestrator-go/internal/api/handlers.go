package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/config"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/models"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/queue"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/worktree"
	"github.com/rs/zerolog/log"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	cfg             *config.Config
	queueManager    *queue.Manager
	worktreeManager *worktree.Manager
}

// NewHandlers creates a new Handlers instance
func NewHandlers(cfg *config.Config, qm *queue.Manager, wm *worktree.Manager) *Handlers {
	return &Handlers{
		cfg:             cfg,
		queueManager:    qm,
		worktreeManager: wm,
	}
}

// Health returns the health status of the service
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	response := models.HealthResponse{
		Status:    "healthy",
		Version:   "0.1.0",
		Uptime:    time.Since(startTime).String(),
		Queue:     *h.queueManager.GetStats(),
		Worktrees: *h.worktreeManager.GetStats(),
	}

	writeJSON(w, http.StatusOK, response)
}

// Metrics returns Prometheus-compatible metrics
func (h *Handlers) Metrics(w http.ResponseWriter, r *http.Request) {
	stats := h.queueManager.GetStats()
	wtStats := h.worktreeManager.GetStats()

	// Simple text format for now
	metrics := `# HELP autobuild_jobs_total Total number of jobs
# TYPE autobuild_jobs_total gauge
autobuild_jobs_total{status="pending"} %d
autobuild_jobs_total{status="running"} %d
autobuild_jobs_total{status="completed"} %d
autobuild_jobs_total{status="failed"} %d
# HELP autobuild_workers_active Number of active workers
# TYPE autobuild_workers_active gauge
autobuild_workers_active %d
# HELP autobuild_workers_max Maximum number of workers
# TYPE autobuild_workers_max gauge
autobuild_workers_max %d
# HELP autobuild_worktrees_active Number of active worktrees
# TYPE autobuild_worktrees_active gauge
autobuild_worktrees_active %d
`
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(
		formatMetrics(metrics,
			stats.PendingJobs,
			stats.RunningJobs,
			stats.CompletedJobs,
			stats.FailedJobs,
			stats.ActiveWorkers,
			stats.MaxWorkers,
			wtStats.Active,
		),
	))
}

// CreateJob creates a new agent job
func (h *Handlers) CreateJob(w http.ResponseWriter, r *http.Request) {
	var req models.CreateJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.TicketID == "" || req.ProjectID == "" || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "ticket_id, project_id, and prompt are required")
		return
	}

	response, err := h.queueManager.Submit(r.Context(), &req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to submit job")
		writeError(w, http.StatusInternalServerError, "Failed to submit job")
		return
	}

	writeJSON(w, http.StatusCreated, response)
}

// ListJobs returns all jobs
func (h *Handlers) ListJobs(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement pagination and filtering
	stats := h.queueManager.GetStats()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"jobs":  []interface{}{}, // TODO: Get actual jobs
		"stats": stats,
	})
}

// GetJob returns a specific job
func (h *Handlers) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobID")

	job, ok := h.queueManager.GetJob(jobID)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	writeJSON(w, http.StatusOK, job)
}

// CancelJob cancels a job
func (h *Handlers) CancelJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobID")

	err := h.queueManager.CancelJob(jobID)
	if err != nil {
		if err == queue.ErrJobNotFound {
			writeError(w, http.StatusNotFound, "Job not found")
			return
		}
		if err == queue.ErrJobAlreadyCompleted {
			writeError(w, http.StatusConflict, "Job already completed")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to cancel job")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Job cancelled"})
}

// GetJobLogs returns the logs for a job
func (h *Handlers) GetJobLogs(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobID")

	job, ok := h.queueManager.GetJob(jobID)
	if !ok {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}

	// TODO: Implement log streaming
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"job_id": job.ID,
		"logs":   []string{},
	})
}

// ListWorktrees returns all worktrees
func (h *Handlers) ListWorktrees(w http.ResponseWriter, r *http.Request) {
	worktrees := h.worktreeManager.List()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"worktrees": worktrees,
		"stats":     h.worktreeManager.GetStats(),
	})
}

// CreateWorktree creates a new worktree
func (h *Handlers) CreateWorktree(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID  string `json:"project_id"`
		TicketID   string `json:"ticket_id"`
		BranchName string `json:"branch_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	wt, err := h.worktreeManager.Create(req.ProjectID, req.TicketID, req.BranchName)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create worktree")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, wt)
}

// DeleteWorktree deletes a worktree
func (h *Handlers) DeleteWorktree(w http.ResponseWriter, r *http.Request) {
	worktreeID := chi.URLParam(r, "worktreeID")

	err := h.worktreeManager.Delete(worktreeID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Worktree deleted"})
}

// GetQueueStatus returns the queue status
func (h *Handlers) GetQueueStatus(w http.ResponseWriter, r *http.Request) {
	stats := h.queueManager.GetStats()
	writeJSON(w, http.StatusOK, stats)
}

// HandleCallback handles callbacks from GitHub Actions
func (h *Handlers) HandleCallback(w http.ResponseWriter, r *http.Request) {
	// Verify authorization
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		writeError(w, http.StatusUnauthorized, "Missing authorization header")
		return
	}

	var result models.JobResult
	if err := json.NewDecoder(r.Body).Decode(&result); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result.ReceivedAt = time.Now()

	h.queueManager.HandleCallback(&result)

	writeJSON(w, http.StatusOK, map[string]string{"message": "Callback received"})
}

// Helper functions

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func formatMetrics(format string, args ...interface{}) string {
	return formatString(format, args...)
}

func formatString(format string, args ...interface{}) string {
	result := format
	for i, arg := range args {
		placeholder := "%d"
		if i < len(args) {
			result = replaceFirst(result, placeholder, arg)
		}
	}
	return result
}

func replaceFirst(s, old string, new interface{}) string {
	for i := 0; i < len(s)-len(old)+1; i++ {
		if s[i:i+len(old)] == old {
			return s[:i] + formatArg(new) + s[i+len(old):]
		}
	}
	return s
}

func formatArg(arg interface{}) string {
	switch v := arg.(type) {
	case int:
		return intToString(v)
	default:
		return ""
	}
}

func intToString(n int) string {
	if n == 0 {
		return "0"
	}
	result := ""
	negative := n < 0
	if negative {
		n = -n
	}
	for n > 0 {
		result = string(rune('0'+n%10)) + result
		n /= 10
	}
	if negative {
		result = "-" + result
	}
	return result
}
