package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User represents a user stored in PostgreSQL
type User struct {
	ID               string
	Username         string
	FingerprintHash  string
	RecoveryCodeHash string
	CreatedAt        time.Time
	LastSeenAt       time.Time
}

// UserStore handles user persistence in PostgreSQL
type UserStore struct {
	pool *pgxpool.Pool
}

// NewUserStore creates a new PostgreSQL user store
func NewUserStore(pool *pgxpool.Pool) *UserStore {
	return &UserStore{pool: pool}
}

// Create creates a new user and returns it with the generated ID
func (s *UserStore) Create(ctx context.Context, username, fingerprintHash, recoveryCodeHash string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (username, fingerprint_hash, recovery_code_hash)
		VALUES ($1, $2, $3)
		RETURNING id, username, fingerprint_hash, recovery_code_hash, created_at, last_seen_at
	`, username, fingerprintHash, recoveryCodeHash).Scan(
		&user.ID, &user.Username, &user.FingerprintHash,
		&user.RecoveryCodeHash, &user.CreatedAt, &user.LastSeenAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByID retrieves a user by their ID
func (s *UserStore) GetByID(ctx context.Context, id string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, fingerprint_hash, recovery_code_hash, created_at, last_seen_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Username, &user.FingerprintHash,
		&user.RecoveryCodeHash, &user.CreatedAt, &user.LastSeenAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByUsername retrieves a user by their username
func (s *UserStore) GetByUsername(ctx context.Context, username string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, fingerprint_hash, recovery_code_hash, created_at, last_seen_at
		FROM users WHERE username = $1
	`, username).Scan(
		&user.ID, &user.Username, &user.FingerprintHash,
		&user.RecoveryCodeHash, &user.CreatedAt, &user.LastSeenAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByFingerprint finds a user by fingerprint hash
func (s *UserStore) GetByFingerprint(ctx context.Context, fingerprintHash string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, fingerprint_hash, recovery_code_hash, created_at, last_seen_at
		FROM users WHERE fingerprint_hash = $1
	`, fingerprintHash).Scan(
		&user.ID, &user.Username, &user.FingerprintHash,
		&user.RecoveryCodeHash, &user.CreatedAt, &user.LastSeenAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByRecoveryCode finds a user by recovery code hash
func (s *UserStore) GetByRecoveryCode(ctx context.Context, recoveryCodeHash string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx, `
		SELECT id, username, fingerprint_hash, recovery_code_hash, created_at, last_seen_at
		FROM users WHERE recovery_code_hash = $1
	`, recoveryCodeHash).Scan(
		&user.ID, &user.Username, &user.FingerprintHash,
		&user.RecoveryCodeHash, &user.CreatedAt, &user.LastSeenAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateLastSeen updates the last seen timestamp for a user
func (s *UserStore) UpdateLastSeen(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET last_seen_at = NOW() WHERE id = $1
	`, id)
	return err
}

// UpdateFingerprint updates the fingerprint hash for a user
func (s *UserStore) UpdateFingerprint(ctx context.Context, id, fingerprintHash string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET fingerprint_hash = $1, last_seen_at = NOW() WHERE id = $2
	`, fingerprintHash, id)
	return err
}

// Count returns the total number of users
func (s *UserStore) Count(ctx context.Context) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

// Delete removes a user by ID
func (s *UserStore) Delete(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}
