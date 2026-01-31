package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env    string
	Server ServerConfig
	Queue  QueueConfig
	Worktree WorktreeConfig
	GitHub GitHubConfig
	Database DatabaseConfig
	MemoryService MemoryServiceConfig
}

type ServerConfig struct {
	Host string
	Port int
}

type QueueConfig struct {
	MaxParallelJobs int
	JobTimeout      time.Duration
	RetryAttempts   int
}

type WorktreeConfig struct {
	BasePath        string
	MaxActive       int
	CleanupInterval time.Duration
	MaxAge          time.Duration
}

type GitHubConfig struct {
	AppID          string
	InstallationID string
	PrivateKeyPath string
	WebhookSecret  string
}

type DatabaseConfig struct {
	URL            string
	MaxConnections int
}

type MemoryServiceConfig struct {
	URL     string
	Timeout time.Duration
	Token   string
}

func Load() (*Config, error) {
	cfg := &Config{
		Env: getEnv("ENV", "development"),
		Server: ServerConfig{
			Host: getEnv("HOST", "0.0.0.0"),
			Port: getEnvInt("PORT", 8080),
		},
		Queue: QueueConfig{
			MaxParallelJobs: getEnvInt("MAX_PARALLEL_JOBS", 12),
			JobTimeout:      getEnvDuration("JOB_TIMEOUT", 30*time.Minute),
			RetryAttempts:   getEnvInt("RETRY_ATTEMPTS", 3),
		},
		Worktree: WorktreeConfig{
			BasePath:        getEnv("WORKTREE_BASE_PATH", "/tmp/autobuild-worktrees"),
			MaxActive:       getEnvInt("WORKTREE_MAX_ACTIVE", 20),
			CleanupInterval: getEnvDuration("WORKTREE_CLEANUP_INTERVAL", 5*time.Minute),
			MaxAge:          getEnvDuration("WORKTREE_MAX_AGE", 2*time.Hour),
		},
		GitHub: GitHubConfig{
			AppID:          getEnv("GITHUB_APP_ID", ""),
			InstallationID: getEnv("GITHUB_INSTALLATION_ID", ""),
			PrivateKeyPath: getEnv("GITHUB_PRIVATE_KEY_PATH", ""),
			WebhookSecret:  getEnv("GITHUB_WEBHOOK_SECRET", ""),
		},
		Database: DatabaseConfig{
			URL:            getEnv("DATABASE_URL", ""),
			MaxConnections: getEnvInt("DATABASE_MAX_CONNECTIONS", 25),
		},
		MemoryService: MemoryServiceConfig{
			URL:     getEnv("MEMORY_SERVICE_URL", "http://localhost:8000"),
			Timeout: getEnvDuration("MEMORY_SERVICE_TIMEOUT", 30*time.Second),
			Token:   getEnv("MEMORY_SERVICE_TOKEN", ""),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Database.URL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
