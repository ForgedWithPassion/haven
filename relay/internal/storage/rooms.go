package storage

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

// RoomData represents a persisted room
type RoomData struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	CreatorID       string    `json:"creator_id"`
	CreatorUsername string    `json:"creator_username"`
	IsPublic        bool      `json:"is_public"`
	CreatedAt       time.Time `json:"created_at"`
	LastActivityAt  time.Time `json:"last_activity_at"`
}

// RoomStore handles persistent storage of rooms
type RoomStore struct {
	filePath string
	rooms    map[string]*RoomData
	mu       sync.RWMutex
}

// NewRoomStore creates a new room store
func NewRoomStore(filePath string) (*RoomStore, error) {
	store := &RoomStore{
		filePath: filePath,
		rooms:    make(map[string]*RoomData),
	}

	// Load existing rooms from file
	if err := store.load(); err != nil {
		// If file doesn't exist, that's fine - start fresh
		if !os.IsNotExist(err) {
			return nil, err
		}
	}

	return store, nil
}

// load reads rooms from the storage file
func (s *RoomStore) load() error {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	// Handle empty file
	if len(data) == 0 {
		return nil
	}

	var rooms []*RoomData
	if err := json.Unmarshal(data, &rooms); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.rooms = make(map[string]*RoomData)
	for _, room := range rooms {
		s.rooms[room.ID] = room
	}

	return nil
}

// save writes rooms to the storage file
func (s *RoomStore) save() error {
	s.mu.RLock()
	rooms := make([]*RoomData, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	s.mu.RUnlock()

	data, err := json.MarshalIndent(rooms, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0644)
}

// SaveRoom saves or updates a room
func (s *RoomStore) SaveRoom(room *RoomData) error {
	s.mu.Lock()
	s.rooms[room.ID] = room
	s.mu.Unlock()

	return s.save()
}

// GetRoom retrieves a room by ID
func (s *RoomStore) GetRoom(id string) *RoomData {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rooms[id]
}

// GetAllRooms returns all stored rooms
func (s *RoomStore) GetAllRooms() []*RoomData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rooms := make([]*RoomData, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	return rooms
}

// DeleteRoom removes a room from storage
func (s *RoomStore) DeleteRoom(id string) error {
	s.mu.Lock()
	delete(s.rooms, id)
	s.mu.Unlock()

	return s.save()
}

// UpdateActivity updates the last activity timestamp for a room
func (s *RoomStore) UpdateActivity(id string) error {
	s.mu.Lock()
	if room, ok := s.rooms[id]; ok {
		room.LastActivityAt = time.Now()
	}
	s.mu.Unlock()

	return s.save()
}

// CleanupInactive removes rooms that have been inactive for longer than the threshold
// Returns the number of rooms deleted
func (s *RoomStore) CleanupInactive(threshold time.Duration) (int, error) {
	s.mu.Lock()

	now := time.Now()
	toDelete := make([]string, 0)

	for id, room := range s.rooms {
		if now.Sub(room.LastActivityAt) > threshold {
			toDelete = append(toDelete, id)
		}
	}

	for _, id := range toDelete {
		delete(s.rooms, id)
	}
	s.mu.Unlock()

	if len(toDelete) > 0 {
		if err := s.save(); err != nil {
			return len(toDelete), err
		}
	}

	return len(toDelete), nil
}

// Count returns the number of stored rooms
func (s *RoomStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.rooms)
}
