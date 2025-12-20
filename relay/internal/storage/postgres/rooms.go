package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Room represents a room stored in PostgreSQL
type Room struct {
	ID              string
	Name            string
	CreatorID       string
	CreatorUsername string
	IsPublic        bool
	CreatedAt       time.Time
	LastActivityAt  time.Time
}

// RoomStore handles room persistence in PostgreSQL
type RoomStore struct {
	pool *pgxpool.Pool
}

// NewRoomStore creates a new PostgreSQL room store
func NewRoomStore(pool *pgxpool.Pool) *RoomStore {
	return &RoomStore{pool: pool}
}

// Create creates a new room and returns it with the generated ID
func (s *RoomStore) Create(ctx context.Context, name, creatorID, creatorUsername string, isPublic bool) (*Room, error) {
	var room Room
	err := s.pool.QueryRow(ctx, `
		INSERT INTO rooms (name, creator_id, creator_username, is_public)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, creator_id, creator_username, is_public, created_at, last_activity_at
	`, name, creatorID, creatorUsername, isPublic).Scan(
		&room.ID, &room.Name, &room.CreatorID, &room.CreatorUsername,
		&room.IsPublic, &room.CreatedAt, &room.LastActivityAt,
	)
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetByID retrieves a room by its ID
func (s *RoomStore) GetByID(ctx context.Context, id string) (*Room, error) {
	var room Room
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, creator_id, creator_username, is_public, created_at, last_activity_at
		FROM rooms WHERE id = $1
	`, id).Scan(
		&room.ID, &room.Name, &room.CreatorID, &room.CreatorUsername,
		&room.IsPublic, &room.CreatedAt, &room.LastActivityAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &room, nil
}

// GetAll returns all rooms
func (s *RoomStore) GetAll(ctx context.Context) ([]*Room, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, creator_id, creator_username, is_public, created_at, last_activity_at
		FROM rooms ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []*Room
	for rows.Next() {
		var room Room
		err := rows.Scan(
			&room.ID, &room.Name, &room.CreatorID, &room.CreatorUsername,
			&room.IsPublic, &room.CreatedAt, &room.LastActivityAt,
		)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, &room)
	}
	return rooms, rows.Err()
}

// GetPublic returns all public rooms
func (s *RoomStore) GetPublic(ctx context.Context) ([]*Room, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, creator_id, creator_username, is_public, created_at, last_activity_at
		FROM rooms WHERE is_public = true ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []*Room
	for rows.Next() {
		var room Room
		err := rows.Scan(
			&room.ID, &room.Name, &room.CreatorID, &room.CreatorUsername,
			&room.IsPublic, &room.CreatedAt, &room.LastActivityAt,
		)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, &room)
	}
	return rooms, rows.Err()
}

// UpdateActivity updates the last activity timestamp for a room
func (s *RoomStore) UpdateActivity(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE rooms SET last_activity_at = NOW() WHERE id = $1
	`, id)
	return err
}

// Delete removes a room by ID
func (s *RoomStore) Delete(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	return err
}

// Count returns the total number of rooms
func (s *RoomStore) Count(ctx context.Context) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rooms`).Scan(&count)
	return count, err
}

// CleanupInactive removes rooms that have been inactive for longer than the threshold
// Returns the number of rooms deleted
func (s *RoomStore) CleanupInactive(ctx context.Context, threshold time.Duration) (int, error) {
	cutoff := time.Now().Add(-threshold)
	result, err := s.pool.Exec(ctx, `
		DELETE FROM rooms WHERE last_activity_at < $1
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}
