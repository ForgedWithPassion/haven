package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Member represents a room membership stored in PostgreSQL
type Member struct {
	RoomID   string
	UserID   string
	Username string
	JoinedAt time.Time
}

// MemberStore handles room membership persistence in PostgreSQL
type MemberStore struct {
	pool *pgxpool.Pool
}

// NewMemberStore creates a new PostgreSQL member store
func NewMemberStore(pool *pgxpool.Pool) *MemberStore {
	return &MemberStore{pool: pool}
}

// Add adds a user to a room. If already a member, returns existing membership.
func (s *MemberStore) Add(ctx context.Context, roomID, userID, username string) (*Member, error) {
	var member Member
	err := s.pool.QueryRow(ctx, `
		INSERT INTO room_members (room_id, user_id, username)
		VALUES ($1, $2, $3)
		ON CONFLICT (room_id, user_id) DO UPDATE SET username = EXCLUDED.username
		RETURNING room_id, user_id, username, joined_at
	`, roomID, userID, username).Scan(
		&member.RoomID, &member.UserID, &member.Username, &member.JoinedAt,
	)
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// Remove removes a user from a room
func (s *MemberStore) Remove(ctx context.Context, roomID, userID string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM room_members WHERE room_id = $1 AND user_id = $2
	`, roomID, userID)
	return err
}

// IsMember checks if a user is a member of a room
func (s *MemberStore) IsMember(ctx context.Context, roomID, userID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2)
	`, roomID, userID).Scan(&exists)
	return exists, err
}

// GetRoomMembers returns all members of a room
func (s *MemberStore) GetRoomMembers(ctx context.Context, roomID string) ([]*Member, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT room_id, user_id, username, joined_at
		FROM room_members WHERE room_id = $1 ORDER BY joined_at
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []*Member
	for rows.Next() {
		var member Member
		err := rows.Scan(&member.RoomID, &member.UserID, &member.Username, &member.JoinedAt)
		if err != nil {
			return nil, err
		}
		members = append(members, &member)
	}
	return members, rows.Err()
}

// GetUserRooms returns all room IDs a user is a member of
func (s *MemberStore) GetUserRooms(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT room_id FROM room_members WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roomIDs []string
	for rows.Next() {
		var roomID string
		if err := rows.Scan(&roomID); err != nil {
			return nil, err
		}
		roomIDs = append(roomIDs, roomID)
	}
	return roomIDs, rows.Err()
}

// CountRoomMembers returns the number of members in a room
func (s *MemberStore) CountRoomMembers(ctx context.Context, roomID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM room_members WHERE room_id = $1
	`, roomID).Scan(&count)
	return count, err
}
