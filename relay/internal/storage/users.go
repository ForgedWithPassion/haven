package storage

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// UserData represents a persisted user
type UserData struct {
	Username         string    `json:"username"`
	FingerprintHash  string    `json:"fingerprint_hash"`
	RecoveryCodeHash string    `json:"recovery_code_hash"`
	CreatedAt        time.Time `json:"created_at"`
	LastSeenAt       time.Time `json:"last_seen_at"`
}

// UserStore handles persistent storage of users
type UserStore struct {
	filePath string
	users    map[string]*UserData // username -> UserData
	mu       sync.RWMutex
}

// NewUserStore creates a new user store
func NewUserStore(filePath string) (*UserStore, error) {
	store := &UserStore{
		filePath: filePath,
		users:    make(map[string]*UserData),
	}

	// Load existing users from file
	if err := store.load(); err != nil {
		// If file doesn't exist, that's fine - start fresh
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	return store, nil
}

// load reads users from the storage file
func (s *UserStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	// Handle empty file
	if len(data) == 0 {
		return nil
	}

	var users []*UserData
	if err := json.Unmarshal(data, &users); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.users = make(map[string]*UserData)
	for _, user := range users {
		s.users[user.Username] = user
	}

	return nil
}

// save writes users to the storage file
func (s *UserStore) save() error {
	s.mu.RLock()
	users := make([]*UserData, 0, len(s.users))
	for _, user := range s.users {
		users = append(users, user)
	}
	s.mu.RUnlock()

	data, err := json.MarshalIndent(users, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

// GetByUsername retrieves a user by username
func (s *UserStore) GetByUsername(username string) *UserData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.users[username]
}

// GetByFingerprint finds a user by fingerprint hash
func (s *UserStore) GetByFingerprint(fingerprintHash string) *UserData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.FingerprintHash == fingerprintHash {
			return user
		}
	}
	return nil
}

// GetByRecoveryCode finds a user by recovery code hash
func (s *UserStore) GetByRecoveryCode(recoveryCodeHash string) *UserData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, user := range s.users {
		if user.RecoveryCodeHash == recoveryCodeHash {
			return user
		}
	}
	return nil
}

// SaveUser saves or updates a user
func (s *UserStore) SaveUser(user *UserData) error {
	s.mu.Lock()
	s.users[user.Username] = user
	s.mu.Unlock()

	return s.save()
}

// UpdateLastSeen updates the last seen timestamp
func (s *UserStore) UpdateLastSeen(username string) error {
	s.mu.Lock()
	if user, ok := s.users[username]; ok {
		user.LastSeenAt = time.Now()
	}
	s.mu.Unlock()

	return s.save()
}

// UpdateFingerprint updates the fingerprint hash for a user
func (s *UserStore) UpdateFingerprint(username, fingerprintHash string) error {
	s.mu.Lock()
	if user, ok := s.users[username]; ok {
		user.FingerprintHash = fingerprintHash
		user.LastSeenAt = time.Now()
	}
	s.mu.Unlock()

	return s.save()
}

// Count returns the number of stored users
func (s *UserStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.users)
}
