package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/api"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/config"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/queue"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/worktree"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Load .env file if it exists
	godotenv.Load()

	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("ENV") == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	log.Info().
		Str("env", cfg.Env).
		Int("port", cfg.Server.Port).
		Int("max_parallel", cfg.Queue.MaxParallelJobs).
		Msg("Starting AutoBuild Orchestrator")

	// Initialize components
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize worktree manager
	worktreeManager := worktree.NewManager(cfg.Worktree)
	defer worktreeManager.Cleanup()

	// Initialize queue manager
	queueManager := queue.NewManager(cfg.Queue, worktreeManager)
	go queueManager.Start(ctx)

	// Initialize HTTP server
	router := api.NewRouter(cfg, queueManager, worktreeManager)

	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info().Msgf("Server listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}
