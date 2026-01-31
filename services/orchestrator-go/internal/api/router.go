package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/config"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/queue"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/worktree"
)

var startTime = time.Now()

// NewRouter creates the HTTP router with all routes
func NewRouter(cfg *config.Config, qm *queue.Manager, wm *worktree.Manager) http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Create handlers
	h := NewHandlers(cfg, qm, wm)

	// Routes
	r.Route("/api/v1", func(r chi.Router) {
		// Health & metrics
		r.Get("/health", h.Health)
		r.Get("/metrics", h.Metrics)

		// Jobs
		r.Route("/jobs", func(r chi.Router) {
			r.Post("/", h.CreateJob)
			r.Get("/", h.ListJobs)
			r.Get("/{jobID}", h.GetJob)
			r.Delete("/{jobID}", h.CancelJob)
			r.Get("/{jobID}/logs", h.GetJobLogs)
		})

		// Worktrees
		r.Route("/worktrees", func(r chi.Router) {
			r.Get("/", h.ListWorktrees)
			r.Post("/", h.CreateWorktree)
			r.Delete("/{worktreeID}", h.DeleteWorktree)
		})

		// Queue
		r.Get("/queue", h.GetQueueStatus)

		// Callbacks (from GitHub Actions)
		r.Post("/callback", h.HandleCallback)
	})

	return r
}
