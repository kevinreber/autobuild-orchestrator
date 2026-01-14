package worktree

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/config"
	"github.com/kevinreber/autobuild-orchestrator-go/internal/models"
	"github.com/rs/zerolog/log"
)

// Manager handles git worktree operations
type Manager struct {
	mu         sync.RWMutex
	cfg        config.WorktreeConfig
	worktrees  map[string]*models.Worktree
	repoCache  map[string]string // projectID -> local repo path
}

// NewManager creates a new worktree manager
func NewManager(cfg config.WorktreeConfig) *Manager {
	// Ensure base path exists
	os.MkdirAll(cfg.BasePath, 0755)

	return &Manager{
		cfg:       cfg,
		worktrees: make(map[string]*models.Worktree),
		repoCache: make(map[string]string),
	}
}

// Create creates a new git worktree for a job
func (m *Manager) Create(projectID, ticketID, branchName string) (*models.Worktree, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if we're at capacity
	activeCount := m.countActive()
	if activeCount >= m.cfg.MaxActive {
		return nil, fmt.Errorf("maximum worktrees (%d) reached", m.cfg.MaxActive)
	}

	// Get or clone the repository
	repoPath, err := m.ensureRepo(projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure repo: %w", err)
	}

	// Create worktree
	wtID := uuid.New().String()
	wtPath := filepath.Join(m.cfg.BasePath, wtID)

	// Create the worktree using git
	cmd := exec.Command("git", "worktree", "add", "-b", branchName, wtPath)
	cmd.Dir = repoPath
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("failed to create worktree: %s - %w", string(output), err)
	}

	wt := &models.Worktree{
		ID:         wtID,
		ProjectID:  projectID,
		TicketID:   ticketID,
		Path:       wtPath,
		BranchName: branchName,
		Status:     models.WorktreeStatusActive,
		CreatedAt:  time.Now(),
		LastUsedAt: time.Now(),
	}

	m.worktrees[wtID] = wt

	log.Info().
		Str("worktree_id", wtID).
		Str("project_id", projectID).
		Str("branch", branchName).
		Str("path", wtPath).
		Msg("Created worktree")

	return wt, nil
}

// Get retrieves a worktree by ID
func (m *Manager) Get(wtID string) (*models.Worktree, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	wt, ok := m.worktrees[wtID]
	return wt, ok
}

// Delete removes a worktree
func (m *Manager) Delete(wtID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	wt, ok := m.worktrees[wtID]
	if !ok {
		return fmt.Errorf("worktree not found: %s", wtID)
	}

	// Get repo path
	repoPath, ok := m.repoCache[wt.ProjectID]
	if !ok {
		return fmt.Errorf("repo not found for project: %s", wt.ProjectID)
	}

	// Remove the worktree using git
	cmd := exec.Command("git", "worktree", "remove", "--force", wt.Path)
	cmd.Dir = repoPath
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Warn().
			Str("worktree_id", wtID).
			Str("output", string(output)).
			Err(err).
			Msg("Failed to remove worktree via git, attempting manual cleanup")

		// Manual cleanup
		os.RemoveAll(wt.Path)
	}

	wt.Status = models.WorktreeStatusDeleted
	delete(m.worktrees, wtID)

	log.Info().
		Str("worktree_id", wtID).
		Msg("Deleted worktree")

	return nil
}

// List returns all active worktrees
func (m *Manager) List() []*models.Worktree {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*models.Worktree, 0, len(m.worktrees))
	for _, wt := range m.worktrees {
		result = append(result, wt)
	}
	return result
}

// GetStats returns worktree statistics
func (m *Manager) GetStats() *models.WorktreeStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return &models.WorktreeStats{
		Active:    m.countActive(),
		MaxActive: m.cfg.MaxActive,
	}
}

// Cleanup removes old and unused worktrees
func (m *Manager) Cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for id, wt := range m.worktrees {
		if now.Sub(wt.LastUsedAt) > m.cfg.MaxAge {
			log.Info().
				Str("worktree_id", id).
				Time("last_used", wt.LastUsedAt).
				Msg("Cleaning up stale worktree")

			// Get repo path
			if repoPath, ok := m.repoCache[wt.ProjectID]; ok {
				cmd := exec.Command("git", "worktree", "remove", "--force", wt.Path)
				cmd.Dir = repoPath
				cmd.Run() // Ignore errors
			}

			os.RemoveAll(wt.Path)
			delete(m.worktrees, id)
		}
	}
}

// ensureRepo ensures a repository is cloned locally
func (m *Manager) ensureRepo(projectID string) (string, error) {
	if path, ok := m.repoCache[projectID]; ok {
		return path, nil
	}

	// TODO: Clone the repository
	// This would involve:
	// 1. Looking up the repo URL from the database
	// 2. Cloning it to a local path
	// 3. Caching the path

	return "", fmt.Errorf("repo cloning not yet implemented for project: %s", projectID)
}

// countActive returns the number of active worktrees
func (m *Manager) countActive() int {
	count := 0
	for _, wt := range m.worktrees {
		if wt.Status == models.WorktreeStatusActive {
			count++
		}
	}
	return count
}
