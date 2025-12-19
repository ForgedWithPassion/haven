package hub

import (
	"log"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"

	"haven/internal/auth"
	"haven/internal/client"
	"haven/internal/protocol"
	"haven/internal/room"
	"haven/internal/storage"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,20}$`)
var roomNameRegex = regexp.MustCompile(`^.{1,50}$`)

// Hub maintains the set of active clients and rooms
type Hub struct {
	clients   map[string]*client.Client // clientID -> Client
	usernames map[string]string         // username -> clientID
	rooms     map[string]*room.Room     // roomID -> Room
	store     *storage.RoomStore        // persistent room storage
	userStore *storage.UserStore        // persistent user storage
	mu        sync.RWMutex
}

// New creates a new Hub
func New() *Hub {
	return &Hub{
		clients:   make(map[string]*client.Client),
		usernames: make(map[string]string),
		rooms:     make(map[string]*room.Room),
	}
}

// SetStorage sets the room storage backend
func (h *Hub) SetStorage(store *storage.RoomStore) {
	h.store = store
}

// SetUserStorage sets the user storage backend
func (h *Hub) SetUserStorage(store *storage.UserStore) {
	h.userStore = store
}

// LoadRooms loads persisted rooms from storage
func (h *Hub) LoadRooms() error {
	if h.store == nil {
		return nil
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	storedRooms := h.store.GetAllRooms()
	for _, data := range storedRooms {
		r := room.New(data.ID, data.Name, data.CreatorID, data.CreatorUsername, data.IsPublic)
		h.rooms[data.ID] = r
	}

	log.Printf("Loaded %d rooms from storage", len(storedRooms))
	return nil
}

// CleanupInactiveRooms removes rooms that have been inactive for the specified duration
func (h *Hub) CleanupInactiveRooms(threshold time.Duration) (int, error) {
	if h.store == nil {
		return 0, nil
	}

	count, err := h.store.CleanupInactive(threshold)
	if err != nil {
		return count, err
	}

	if count > 0 {
		// Remove from in-memory map as well
		h.mu.Lock()
		storedRooms := h.store.GetAllRooms()
		storedIDs := make(map[string]bool)
		for _, r := range storedRooms {
			storedIDs[r.ID] = true
		}
		for id := range h.rooms {
			if !storedIDs[id] {
				delete(h.rooms, id)
			}
		}
		h.mu.Unlock()

		log.Printf("Cleaned up %d inactive rooms", count)
	}

	return count, nil
}

// AddClient adds a client to the hub (before registration)
func (h *Hub) AddClient(c *client.Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c.ID] = c
}

// RemoveClient removes a client and cleans up rooms
func (h *Hub) RemoveClient(c *client.Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Remove from rooms and notify members
	for _, roomID := range c.Rooms() {
		if r, ok := h.rooms[roomID]; ok {
			r.RemoveMember(c.ID)

			// Notify remaining members
			h.broadcastToRoomLocked(roomID, c.ID, protocol.TypeRoomMembers, protocol.RoomMembersPayload{
				RoomID:  roomID,
				Action:  "left",
				User:    protocol.UserInfo{UserID: c.ID, Username: c.Username},
				Members: r.MemberInfoList(),
			})
			// Note: We don't delete empty rooms immediately - the cleanup routine handles this based on inactivity
		}
	}

	// Broadcast user_left to all
	if c.Username != "" {
		h.broadcastLocked(c.ID, protocol.TypeUserLeft, protocol.UserLeftPayload{
			UserID:   c.ID,
			Username: c.Username,
		})
		delete(h.usernames, c.Username)
	}

	delete(h.clients, c.ID)
	c.Close()
}

// RegisterResult contains the result of a registration attempt
type RegisterResult struct {
	Success      bool
	RecoveryCode string // Only set for new users (plain text, show once)
	IsNewUser    bool
	Error        *Error
}

// RegisterUser handles user registration with fingerprint and recovery code support
func (h *Hub) RegisterUser(c *client.Client, username, fingerprint, recoveryCode string) *RegisterResult {
	if !usernameRegex.MatchString(username) {
		return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidUsername, Message: "Username must be 3-20 alphanumeric characters"}}
	}

	fingerprintHash := ""
	if fingerprint != "" {
		fingerprintHash = auth.HashValue(fingerprint)
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Check if user exists in persistent storage
	if h.userStore != nil {
		existingUser := h.userStore.GetByUsername(username)

		if existingUser != nil {
			// User exists - validate credentials
			if fingerprint != "" && existingUser.FingerprintHash == fingerprintHash {
				// Fingerprint matches - this is the legitimate owner
				return h.loginExistingUserLocked(c, username, existingUser)
			}

			if recoveryCode != "" {
				// Verify recovery code
				recoveryHash := auth.HashValue(recoveryCode)
				if existingUser.RecoveryCodeHash == recoveryHash {
					// Recovery code valid - update fingerprint and login
					if fingerprint != "" {
						h.userStore.UpdateFingerprint(username, fingerprintHash)
					}
					return h.loginExistingUserLocked(c, username, existingUser)
				}
				// Invalid recovery code
				return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidRecovery, Message: "Invalid recovery code"}}
			}

			// Username exists but no valid credentials provided
			// Check if someone else is currently using this name
			if _, online := h.usernames[username]; online {
				// Username in use AND we don't have valid credentials
				return &RegisterResult{Error: &Error{Code: protocol.ErrCodeRecoveryRequired, Message: "This username is registered. Please enter your recovery code."}}
			}

			// Not online but registered - still need recovery
			return &RegisterResult{Error: &Error{Code: protocol.ErrCodeRecoveryRequired, Message: "This username is registered. Please enter your recovery code."}}
		}

		// New user - generate recovery code and save
		newRecoveryCode, err := auth.GenerateRecoveryCode()
		if err != nil {
			log.Printf("Failed to generate recovery code: %v", err)
			return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Failed to generate recovery code"}}
		}

		newUser := &storage.UserData{
			Username:         username,
			FingerprintHash:  fingerprintHash,
			RecoveryCodeHash: auth.HashValue(newRecoveryCode),
			CreatedAt:        time.Now(),
			LastSeenAt:       time.Now(),
		}

		if err := h.userStore.SaveUser(newUser); err != nil {
			log.Printf("Failed to save user: %v", err)
			return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Failed to save user"}}
		}

		// Complete registration
		h.usernames[username] = c.ID
		c.Username = username

		// Broadcast user_joined
		h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
			UserID:   c.ID,
			Username: username,
		})

		return &RegisterResult{
			Success:      true,
			RecoveryCode: newRecoveryCode,
			IsNewUser:    true,
		}
	}

	// No user storage - fall back to simple username check (original behavior)
	if _, exists := h.usernames[username]; exists {
		return &RegisterResult{Error: &Error{Code: protocol.ErrCodeUsernameInUse, Message: "Username already in use"}}
	}

	h.usernames[username] = c.ID
	c.Username = username

	// Broadcast user_joined
	h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
		UserID:   c.ID,
		Username: username,
	})

	return &RegisterResult{Success: true}
}

// loginExistingUserLocked handles login for an existing user, kicking any imposter
// Must be called with h.mu held
func (h *Hub) loginExistingUserLocked(c *client.Client, username string, userData *storage.UserData) *RegisterResult {
	// Check if someone else is using this username
	if existingClientID, online := h.usernames[username]; online && existingClientID != c.ID {
		// Kick the imposter
		if imposter, ok := h.clients[existingClientID]; ok {
			imposter.SendMessage(protocol.TypeKicked, protocol.KickedPayload{
				Reason: "The account owner has logged in from another device",
			})
			// Clean up imposter
			delete(h.usernames, username)
			// Remove imposter from rooms
			for _, roomID := range imposter.Rooms() {
				if r, ok := h.rooms[roomID]; ok {
					r.RemoveMember(imposter.ID)
				}
			}
			imposter.Close()
			delete(h.clients, existingClientID)
			log.Printf("Kicked imposter %s for username %s", existingClientID, username)
		}
	}

	// Register this client
	h.usernames[username] = c.ID
	c.Username = username

	// Update last seen
	if h.userStore != nil {
		go h.userStore.UpdateLastSeen(username)
	}

	// Broadcast user_joined
	h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
		UserID:   c.ID,
		Username: username,
	})

	return &RegisterResult{Success: true, IsNewUser: false}
}

// GetUserList returns list of online users
func (h *Hub) GetUserList() []protocol.UserInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]protocol.UserInfo, 0, len(h.usernames))
	for username, clientID := range h.usernames {
		users = append(users, protocol.UserInfo{
			UserID:   clientID,
			Username: username,
		})
	}
	return users
}

// GetRoomList returns list of rooms (public rooms + rooms user is member of)
func (h *Hub) GetRoomList(c *client.Client) []protocol.RoomInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	rooms := make([]protocol.RoomInfo, 0)
	for _, r := range h.rooms {
		if r.IsPublic || r.HasMember(c.ID) {
			rooms = append(rooms, r.Info())
		}
	}
	return rooms
}

// SendDirectMessage sends a DM from one user to another
func (h *Hub) SendDirectMessage(from *client.Client, toUsername, content string) error {
	if from.Username == "" {
		return &Error{Code: protocol.ErrCodeNotRegistered, Message: "Must register first"}
	}

	h.mu.RLock()
	toClientID, exists := h.usernames[toUsername]
	if !exists {
		h.mu.RUnlock()
		return &Error{Code: protocol.ErrCodeUserNotFound, Message: "User not found"}
	}
	toClient := h.clients[toClientID]
	h.mu.RUnlock()

	if toClient == nil {
		return &Error{Code: protocol.ErrCodeUserNotFound, Message: "User not found"}
	}

	messageID := uuid.New().String()
	return toClient.SendMessage(protocol.TypeDirectMsg, protocol.IncomingDirectMessage{
		MessageID: messageID,
		From:      from.Username,
		FromID:    from.ID,
		Content:   content,
		Timestamp: protocol.NewEnvelopeTimestamp(),
	})
}

// CreateRoom creates a new room
func (h *Hub) CreateRoom(c *client.Client, name string, isPublic bool) (*room.Room, error) {
	if c.Username == "" {
		return nil, &Error{Code: protocol.ErrCodeNotRegistered, Message: "Must register first"}
	}

	if !roomNameRegex.MatchString(name) {
		return nil, &Error{Code: protocol.ErrCodeInvalidRoomName, Message: "Room name must be 1-50 characters"}
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	roomID := uuid.New().String()
	now := time.Now()
	r := room.New(roomID, name, c.ID, c.Username, isPublic)
	h.rooms[roomID] = r
	c.JoinRoom(roomID)

	// Persist room to storage
	if h.store != nil {
		h.store.SaveRoom(&storage.RoomData{
			ID:              roomID,
			Name:            name,
			CreatorID:       c.ID,
			CreatorUsername: c.Username,
			IsPublic:        isPublic,
			CreatedAt:       now,
			LastActivityAt:  now,
		})
	}

	// Broadcast new public room to all other registered clients
	if isPublic {
		roomInfo := r.Info()
		h.broadcastLocked(c.ID, protocol.TypeRoomCreated, protocol.RoomCreatedPayload{
			Success: true,
			Room:    &roomInfo,
		})
	}

	return r, nil
}

// JoinRoom adds a client to a room
func (h *Hub) JoinRoom(c *client.Client, roomID string) (*room.Room, error) {
	if c.Username == "" {
		return nil, &Error{Code: protocol.ErrCodeNotRegistered, Message: "Must register first"}
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return nil, &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if r.HasMember(c.ID) {
		return nil, &Error{Code: protocol.ErrCodeAlreadyInRoom, Message: "Already in room"}
	}

	r.AddMember(c.ID, c.Username)
	c.JoinRoom(roomID)

	// Notify other members
	h.broadcastToRoomLocked(roomID, c.ID, protocol.TypeRoomMembers, protocol.RoomMembersPayload{
		RoomID:  roomID,
		Action:  "joined",
		User:    protocol.UserInfo{UserID: c.ID, Username: c.Username},
		Members: r.MemberInfoList(),
	})

	return r, nil
}

// LeaveRoom removes a client from a room
func (h *Hub) LeaveRoom(c *client.Client, roomID string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if !r.HasMember(c.ID) {
		return &Error{Code: protocol.ErrCodeNotInRoom, Message: "Not in room"}
	}

	r.RemoveMember(c.ID)
	c.LeaveRoom(roomID)

	// Notify other members
	h.broadcastToRoomLocked(roomID, c.ID, protocol.TypeRoomMembers, protocol.RoomMembersPayload{
		RoomID:  roomID,
		Action:  "left",
		User:    protocol.UserInfo{UserID: c.ID, Username: c.Username},
		Members: r.MemberInfoList(),
	})
	// Note: We don't delete empty rooms immediately - the cleanup routine handles this based on inactivity

	return nil
}

// SendRoomMessage sends a message to all room members
func (h *Hub) SendRoomMessage(from *client.Client, roomID, content string) error {
	if from.Username == "" {
		return &Error{Code: protocol.ErrCodeNotRegistered, Message: "Must register first"}
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if !r.HasMember(from.ID) {
		return &Error{Code: protocol.ErrCodeNotInRoom, Message: "Not in room"}
	}

	messageID := uuid.New().String()
	msg := protocol.IncomingRoomMessage{
		MessageID: messageID,
		RoomID:    roomID,
		From:      from.Username,
		FromID:    from.ID,
		Content:   content,
		Timestamp: protocol.NewEnvelopeTimestamp(),
	}

	// Send to all members including sender
	for _, memberID := range r.MemberList() {
		if c, ok := h.clients[memberID]; ok {
			c.SendMessage(protocol.TypeRoomMessage, msg)
		}
	}

	// Update room activity in storage
	if h.store != nil {
		go h.store.UpdateActivity(roomID)
	}

	return nil
}

// GetRoom returns a room by ID
func (h *Hub) GetRoom(roomID string) *room.Room {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[roomID]
}

// broadcastLocked sends a message to all registered clients except excludeID
// Must be called with h.mu held
func (h *Hub) broadcastLocked(excludeID string, msgType protocol.MessageType, payload interface{}) {
	for id, c := range h.clients {
		if id != excludeID && c.Username != "" {
			c.SendMessage(msgType, payload)
		}
	}
}

// broadcastToRoomLocked sends a message to all room members except excludeID
// Must be called with h.mu held
func (h *Hub) broadcastToRoomLocked(roomID, excludeID string, msgType protocol.MessageType, payload interface{}) {
	r, exists := h.rooms[roomID]
	if !exists {
		return
	}

	for _, memberID := range r.MemberList() {
		if memberID != excludeID {
			if c, ok := h.clients[memberID]; ok {
				c.SendMessage(msgType, payload)
			}
		}
	}
}

// Error represents a hub error
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string {
	return e.Message
}
