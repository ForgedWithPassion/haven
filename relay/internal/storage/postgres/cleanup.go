package postgres

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CleanupConfig holds the configuration for cleanup operations
type CleanupConfig struct {
	UserInactivityTimeout time.Duration
	RoomInactivityTimeout time.Duration
	MessageRetention      time.Duration
}

// CleanupStats holds the statistics from a cleanup run
type CleanupStats struct {
	UsersDeleted    int
	RoomsDeleted    int
	MessagesDeleted int
}

// Cleanup handles periodic cleanup of old data
type Cleanup struct {
	pool *pgxpool.Pool
}

// NewCleanup creates a new Cleanup instance
func NewCleanup(pool *pgxpool.Pool) *Cleanup {
	return &Cleanup{pool: pool}
}

// InactiveUsers deletes users who haven't been seen for longer than the threshold
// Returns the number of users deleted
func (c *Cleanup) InactiveUsers(ctx context.Context, threshold time.Duration) (int, error) {
	cutoff := time.Now().Add(-threshold)
	result, err := c.pool.Exec(ctx, `
		DELETE FROM users WHERE last_seen_at < $1
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// InactiveRooms deletes rooms that haven't had activity for longer than the threshold
// Returns the number of rooms deleted (cascade deletes members and messages)
func (c *Cleanup) InactiveRooms(ctx context.Context, threshold time.Duration) (int, error) {
	cutoff := time.Now().Add(-threshold)
	result, err := c.pool.Exec(ctx, `
		DELETE FROM rooms WHERE last_activity_at < $1
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// OldMessages deletes messages older than the threshold
// Returns the number of messages deleted
func (c *Cleanup) OldMessages(ctx context.Context, threshold time.Duration) (int, error) {
	cutoff := time.Now().Add(-threshold)
	result, err := c.pool.Exec(ctx, `
		DELETE FROM room_messages WHERE created_at < $1
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// RunAll runs all cleanup operations and returns statistics
func (c *Cleanup) RunAll(ctx context.Context, cfg CleanupConfig) (*CleanupStats, error) {
	stats := &CleanupStats{}
	var err error

	// Delete old messages first (before rooms, since room deletion cascades)
	stats.MessagesDeleted, err = c.OldMessages(ctx, cfg.MessageRetention)
	if err != nil {
		return stats, err
	}

	// Delete inactive rooms (cascades to remaining messages and members)
	stats.RoomsDeleted, err = c.InactiveRooms(ctx, cfg.RoomInactivityTimeout)
	if err != nil {
		return stats, err
	}

	// Delete inactive users last (foreign key constraints with rooms)
	stats.UsersDeleted, err = c.InactiveUsers(ctx, cfg.UserInactivityTimeout)
	if err != nil {
		return stats, err
	}

	return stats, nil
}

// CleanupJob runs periodic cleanup in the background
type CleanupJob struct {
	cleanup  *Cleanup
	config   CleanupConfig
	interval time.Duration
	done     chan struct{}
}

// NewCleanupJob creates a new background cleanup job
func NewCleanupJob(pool *pgxpool.Pool, cfg CleanupConfig, interval time.Duration) *CleanupJob {
	return &CleanupJob{
		cleanup:  NewCleanup(pool),
		config:   cfg,
		interval: interval,
		done:     make(chan struct{}),
	}
}

// Start begins the cleanup job in a goroutine
func (j *CleanupJob) Start() {
	go j.run()
}

func (j *CleanupJob) run() {
	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx := context.Background()
			stats, err := j.cleanup.RunAll(ctx, j.config)
			if err != nil {
				log.Printf("Cleanup error: %v", err)
			} else if stats.UsersDeleted > 0 || stats.RoomsDeleted > 0 || stats.MessagesDeleted > 0 {
				log.Printf("Cleanup completed: users=%d, rooms=%d, messages=%d",
					stats.UsersDeleted, stats.RoomsDeleted, stats.MessagesDeleted)
			}
		case <-j.done:
			return
		}
	}
}

// Stop stops the cleanup job
func (j *CleanupJob) Stop() {
	close(j.done)
}
