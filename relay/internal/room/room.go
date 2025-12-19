package room

import (
	"sync"
	"time"

	"haven/internal/protocol"
)

// Member represents a room member
type Member struct {
	UserID   string
	Username string
	JoinedAt time.Time
}

// Room represents a chat room
type Room struct {
	ID        string
	Name      string
	CreatorID string
	Creator   string // Username
	IsPublic  bool
	CreatedAt time.Time
	members   map[string]*Member // userID -> Member
	mu        sync.RWMutex
}

// New creates a new room
func New(id, name, creatorID, creatorUsername string, isPublic bool) *Room {
	r := &Room{
		ID:        id,
		Name:      name,
		CreatorID: creatorID,
		Creator:   creatorUsername,
		IsPublic:  isPublic,
		CreatedAt: time.Now(),
		members:   make(map[string]*Member),
	}
	// Creator auto-joins
	r.members[creatorID] = &Member{
		UserID:   creatorID,
		Username: creatorUsername,
		JoinedAt: time.Now(),
	}
	return r
}

// AddMember adds a member to the room
func (r *Room) AddMember(userID, username string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.members[userID]; exists {
		return false
	}

	r.members[userID] = &Member{
		UserID:   userID,
		Username: username,
		JoinedAt: time.Now(),
	}
	return true
}

// RemoveMember removes a member from the room
func (r *Room) RemoveMember(userID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.members[userID]; !exists {
		return false
	}

	delete(r.members, userID)
	return true
}

// HasMember checks if a user is a member
func (r *Room) HasMember(userID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.members[userID]
	return exists
}

// MemberCount returns the number of members
func (r *Room) MemberCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.members)
}

// IsEmpty returns true if room has no members
func (r *Room) IsEmpty() bool {
	return r.MemberCount() == 0
}

// MemberList returns list of member user IDs
func (r *Room) MemberList() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]string, 0, len(r.members))
	for id := range r.members {
		ids = append(ids, id)
	}
	return ids
}

// MemberInfoList returns list of member info
func (r *Room) MemberInfoList() []protocol.UserInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]protocol.UserInfo, 0, len(r.members))
	for _, m := range r.members {
		infos = append(infos, protocol.UserInfo{
			UserID:   m.UserID,
			Username: m.Username,
		})
	}
	return infos
}

// Info returns the room's public info
func (r *Room) Info() protocol.RoomInfo {
	return protocol.RoomInfo{
		RoomID:      r.ID,
		Name:        r.Name,
		Creator:     r.Creator,
		CreatorID:   r.CreatorID,
		MemberCount: r.MemberCount(),
		IsPublic:    r.IsPublic,
	}
}
