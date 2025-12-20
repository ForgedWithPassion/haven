package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Message represents a room message stored in PostgreSQL
type Message struct {
	ID             string
	RoomID         string
	SenderID       string
	SenderUsername string
	Content        string
	CreatedAt      time.Time
}

// MessageStore handles room message persistence in PostgreSQL
type MessageStore struct {
	pool *pgxpool.Pool
}

// NewMessageStore creates a new PostgreSQL message store
func NewMessageStore(pool *pgxpool.Pool) *MessageStore {
	return &MessageStore{pool: pool}
}

// Save saves a room message and returns it with the generated ID
func (s *MessageStore) Save(ctx context.Context, roomID, senderID, senderUsername, content string) (*Message, error) {
	var msg Message
	err := s.pool.QueryRow(ctx, `
		INSERT INTO room_messages (room_id, sender_id, sender_username, content)
		VALUES ($1, $2, $3, $4)
		RETURNING id, room_id, sender_id, sender_username, content, created_at
	`, roomID, senderID, senderUsername, content).Scan(
		&msg.ID, &msg.RoomID, &msg.SenderID, &msg.SenderUsername, &msg.Content, &msg.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

// GetHistory retrieves message history for a room
// Returns messages in reverse chronological order (newest first)
// If before is not zero, returns messages before that timestamp (for pagination)
func (s *MessageStore) GetHistory(ctx context.Context, roomID string, limit int, before time.Time) ([]*Message, error) {
	var rows interface {
		Close()
		Next() bool
		Scan(...any) error
		Err() error
	}
	var err error

	if before.IsZero() {
		rows, err = s.pool.Query(ctx, `
			SELECT id, room_id, sender_id, sender_username, content, created_at
			FROM room_messages
			WHERE room_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, roomID, limit)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT id, room_id, sender_id, sender_username, content, created_at
			FROM room_messages
			WHERE room_id = $1 AND created_at < $2
			ORDER BY created_at DESC
			LIMIT $3
		`, roomID, before, limit)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*Message
	for rows.Next() {
		var msg Message
		err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.SenderUsername, &msg.Content, &msg.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, &msg)
	}
	return messages, rows.Err()
}

// CountInRoom returns the number of messages in a room
func (s *MessageStore) CountInRoom(ctx context.Context, roomID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM room_messages WHERE room_id = $1
	`, roomID).Scan(&count)
	return count, err
}

// Delete removes a message by ID
func (s *MessageStore) Delete(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM room_messages WHERE id = $1`, id)
	return err
}

// DeleteOlderThan removes messages older than the specified time
// Returns the number of messages deleted
func (s *MessageStore) DeleteOlderThan(ctx context.Context, threshold time.Time) (int, error) {
	result, err := s.pool.Exec(ctx, `
		DELETE FROM room_messages WHERE created_at < $1
	`, threshold)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}
