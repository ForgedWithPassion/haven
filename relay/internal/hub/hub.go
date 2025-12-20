package hub

import (
	"context"
	"log"
	"regexp"
	"sync"
	"time"

	"github.com/google/uuid"

	"haven/internal/auth"
	"haven/internal/client"
	"haven/internal/protocol"
	"haven/internal/room"
	"haven/internal/storage/postgres"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,20}$`)
var roomNameRegex = regexp.MustCompile(`^.{1,50}$`)

// Hub maintains the set of active clients and rooms
type Hub struct {
	clients      map[string]*client.Client // clientID -> Client
	usernames    map[string]string         // username -> clientID
	userIDs      map[string]string         // db userID -> clientID (for looking up online users by DB ID)
	rooms        map[string]*room.Room     // roomID -> Room
	roomStore    *postgres.RoomStore       // persistent room storage
	userStore    *postgres.UserStore       // persistent user storage
	memberStore  *postgres.MemberStore     // persistent room membership
	messageStore *postgres.MessageStore    // persistent room messages
	mu           sync.RWMutex
}

// New creates a new Hub
func New() *Hub {
	return &Hub{
		clients:   make(map[string]*client.Client),
		usernames: make(map[string]string),
		userIDs:   make(map[string]string),
		rooms:     make(map[string]*room.Room),
	}
}

// SetStores sets all storage backends
func (h *Hub) SetStores(roomStore *postgres.RoomStore, userStore *postgres.UserStore, memberStore *postgres.MemberStore, messageStore *postgres.MessageStore) {
	h.roomStore = roomStore
	h.userStore = userStore
	h.memberStore = memberStore
	h.messageStore = messageStore
}

// LoadRooms loads persisted rooms from storage and restores membership
func (h *Hub) LoadRooms() error {
	if h.roomStore == nil {
		return nil
	}

	ctx := context.Background()

	h.mu.Lock()
	defer h.mu.Unlock()

	storedRooms, err := h.roomStore.GetAll(ctx)
	if err != nil {
		return err
	}

	for _, data := range storedRooms {
		r := room.New(data.ID, data.Name, data.CreatorID, data.CreatorUsername, data.IsPublic)

		// Load persisted members for this room
		if h.memberStore != nil {
			members, err := h.memberStore.GetRoomMembers(ctx, data.ID)
			if err != nil {
				log.Printf("Failed to load members for room %s: %v", data.ID, err)
			} else {
				for _, m := range members {
					r.AddMember(m.UserID, m.Username)
				}
			}
		}

		h.rooms[data.ID] = r
	}

	log.Printf("Loaded %d rooms from storage", len(storedRooms))
	return nil
}

// CleanupInactiveRooms removes rooms that have been inactive for the specified duration
// Note: The PostgreSQL cleanup job handles this now via CASCADE deletes
func (h *Hub) CleanupInactiveRooms(threshold time.Duration) (int, error) {
	if h.roomStore == nil {
		return 0, nil
	}

	ctx := context.Background()
	count, err := h.roomStore.CleanupInactive(ctx, threshold)
	if err != nil {
		return count, err
	}

	if count > 0 {
		// Remove from in-memory map as well
		h.mu.Lock()
		storedRooms, _ := h.roomStore.GetAll(ctx)
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

// RemoveClient removes a client from the hub
// NOTE: We intentionally do NOT remove users from rooms on disconnect.
// Users remain room members even when offline. They are only removed
// from rooms via explicit LeaveRoom calls.
func (h *Hub) RemoveClient(c *client.Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Broadcast user_left to all (this notifies that user is offline)
	if c.Username != "" {
		userIDForBroadcast := c.UserID
		if userIDForBroadcast == "" {
			userIDForBroadcast = c.ID // Fallback for non-DB mode
		}
		h.broadcastLocked(c.ID, protocol.TypeUserLeft, protocol.UserLeftPayload{
			UserID:   userIDForBroadcast,
			Username: c.Username,
		})
		delete(h.usernames, c.Username)
	}
	if c.UserID != "" {
		delete(h.userIDs, c.UserID)
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

	ctx := context.Background()

	h.mu.Lock()
	defer h.mu.Unlock()

	// Check if user exists in persistent storage
	if h.userStore != nil {
		existingUser, err := h.userStore.GetByUsername(ctx, username)
		if err != nil {
			log.Printf("Failed to get user: %v", err)
			return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Database error"}}
		}

		if existingUser != nil {
			// User exists - validate credentials
			if fingerprint != "" && existingUser.FingerprintHash == fingerprintHash {
				// Fingerprint matches - this is the legitimate owner
				return h.loginExistingUserLocked(ctx, c, username, existingUser)
			}

			if recoveryCode != "" {
				// Verify recovery code
				recoveryHash := auth.HashValue(recoveryCode)
				if existingUser.RecoveryCodeHash == recoveryHash {
					// Recovery code valid - update fingerprint and login
					if fingerprint != "" {
						_ = h.userStore.UpdateFingerprint(ctx, existingUser.ID, fingerprintHash)
					}
					return h.loginExistingUserLocked(ctx, c, username, existingUser)
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

		newUser, err := h.userStore.Create(ctx, username, fingerprintHash, auth.HashValue(newRecoveryCode))
		if err != nil {
			log.Printf("Failed to save user: %v", err)
			return &RegisterResult{Error: &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Failed to save user"}}
		}

		// Complete registration - set both UserID (DB) and maintain mappings
		c.UserID = newUser.ID
		c.Username = username
		h.usernames[username] = c.ID
		h.userIDs[c.UserID] = c.ID

		// Broadcast user_joined (use UserID for consistency with room membership)
		h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
			UserID:   c.UserID,
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

	// In non-DB mode, use connection ID as UserID for consistency
	c.UserID = c.ID
	c.Username = username
	h.usernames[username] = c.ID
	h.userIDs[c.UserID] = c.ID

	// Broadcast user_joined
	h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
		UserID:   c.UserID,
		Username: username,
	})

	return &RegisterResult{Success: true}
}

// loginExistingUserLocked handles login for an existing user, kicking any imposter
// Must be called with h.mu held
func (h *Hub) loginExistingUserLocked(ctx context.Context, c *client.Client, username string, userData *postgres.User) *RegisterResult {
	// Check if someone else is using this username
	if existingClientID, online := h.usernames[username]; online && existingClientID != c.ID {
		// Kick the imposter
		if imposter, ok := h.clients[existingClientID]; ok {
			_ = imposter.SendMessage(protocol.TypeKicked, protocol.KickedPayload{
				Reason: "The account owner has logged in from another device",
			})
			// Clean up imposter
			delete(h.usernames, username)
			if imposter.UserID != "" {
				delete(h.userIDs, imposter.UserID)
			}
			// Note: We don't remove imposter from rooms - room membership persists
			imposter.Close()
			delete(h.clients, existingClientID)
			log.Printf("Kicked imposter %s for username %s", existingClientID, username)
		}
	}

	// Register this client - set both UserID (DB) and maintain mappings
	c.UserID = userData.ID
	c.Username = username
	h.usernames[username] = c.ID
	h.userIDs[c.UserID] = c.ID

	// Update last seen
	if h.userStore != nil {
		go func() { _ = h.userStore.UpdateLastSeen(context.Background(), userData.ID) }()
	}

	// Broadcast user_joined (use UserID for consistency with room membership)
	h.broadcastLocked(c.ID, protocol.TypeUserJoined, protocol.UserJoinedPayload{
		UserID:   c.UserID,
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
		userID := clientID // Default to connection ID
		if c, ok := h.clients[clientID]; ok && c.UserID != "" {
			userID = c.UserID // Use DB user ID if available
		}
		users = append(users, protocol.UserInfo{
			UserID:   userID,
			Username: username,
		})
	}
	return users
}

// GetRoomList returns list of rooms (public rooms + rooms user is member of)
func (h *Hub) GetRoomList(c *client.Client) []protocol.RoomInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	memberID := c.UserID
	if memberID == "" {
		memberID = c.ID // Fallback for non-DB mode
	}

	rooms := make([]protocol.RoomInfo, 0)
	for _, r := range h.rooms {
		if r.IsPublic || r.HasMember(memberID) {
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

	fromID := from.UserID
	if fromID == "" {
		fromID = from.ID // Fallback for non-DB mode
	}

	messageID := uuid.New().String()
	return toClient.SendMessage(protocol.TypeDirectMsg, protocol.IncomingDirectMessage{
		MessageID: messageID,
		From:      from.Username,
		FromID:    fromID,
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

	// Use database UserID for persistence, fall back to connection ID
	creatorID := c.UserID
	if creatorID == "" {
		creatorID = c.ID
	}

	ctx := context.Background()

	h.mu.Lock()
	defer h.mu.Unlock()

	var roomID string

	// Persist room to storage and get ID
	if h.roomStore != nil {
		storedRoom, err := h.roomStore.Create(ctx, name, creatorID, c.Username, isPublic)
		if err != nil {
			log.Printf("Failed to create room in database: %v", err)
			return nil, &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Failed to create room"}
		}
		roomID = storedRoom.ID

		// Add creator as a member
		if h.memberStore != nil {
			_, _ = h.memberStore.Add(ctx, roomID, creatorID, c.Username)
		}
	} else {
		roomID = uuid.New().String()
	}

	r := room.New(roomID, name, creatorID, c.Username, isPublic)
	h.rooms[roomID] = r
	c.JoinRoom(roomID)

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

	// Use database UserID for persistence, fall back to connection ID
	memberID := c.UserID
	if memberID == "" {
		memberID = c.ID
	}

	ctx := context.Background()

	h.mu.Lock()
	defer h.mu.Unlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return nil, &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if r.HasMember(memberID) {
		// Already a member - this is a reconnect, just return the room silently
		c.JoinRoom(roomID) // Ensure client tracks room membership
		return r, nil
	}

	r.AddMember(memberID, c.Username)
	c.JoinRoom(roomID)

	// Persist membership
	if h.memberStore != nil {
		go func() { _, _ = h.memberStore.Add(ctx, roomID, memberID, c.Username) }()
	}

	// Notify other members
	h.broadcastToRoomLocked(roomID, c.ID, protocol.TypeRoomMembers, protocol.RoomMembersPayload{
		RoomID:  roomID,
		Action:  "joined",
		User:    protocol.UserInfo{UserID: memberID, Username: c.Username},
		Members: r.MemberInfoList(),
	})

	return r, nil
}

// LeaveRoom removes a client from a room
func (h *Hub) LeaveRoom(c *client.Client, roomID string) error {
	// Use database UserID for persistence, fall back to connection ID
	memberID := c.UserID
	if memberID == "" {
		memberID = c.ID
	}

	ctx := context.Background()

	h.mu.Lock()
	defer h.mu.Unlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if !r.HasMember(memberID) {
		return &Error{Code: protocol.ErrCodeNotInRoom, Message: "Not in room"}
	}

	r.RemoveMember(memberID)
	c.LeaveRoom(roomID)

	// Remove from persistent membership
	if h.memberStore != nil {
		go func() { _ = h.memberStore.Remove(ctx, roomID, memberID) }()
	}

	// Notify other members
	h.broadcastToRoomLocked(roomID, c.ID, protocol.TypeRoomMembers, protocol.RoomMembersPayload{
		RoomID:  roomID,
		Action:  "left",
		User:    protocol.UserInfo{UserID: memberID, Username: c.Username},
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

	// Use database UserID for persistence, fall back to connection ID
	senderID := from.UserID
	if senderID == "" {
		senderID = from.ID
	}

	ctx := context.Background()

	h.mu.RLock()
	defer h.mu.RUnlock()

	r, exists := h.rooms[roomID]
	if !exists {
		return &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if !r.HasMember(senderID) {
		return &Error{Code: protocol.ErrCodeNotInRoom, Message: "Not in room"}
	}

	var messageID string
	var timestamp int64

	// Persist message to database
	if h.messageStore != nil {
		savedMsg, err := h.messageStore.Save(ctx, roomID, senderID, from.Username, content)
		if err != nil {
			log.Printf("Failed to save message: %v", err)
			// Continue anyway - message will still be delivered in real-time
			messageID = uuid.New().String()
			timestamp = protocol.NewEnvelopeTimestamp()
		} else {
			messageID = savedMsg.ID
			timestamp = savedMsg.CreatedAt.UnixMilli()
		}

		// Update room activity
		go func() { _ = h.roomStore.UpdateActivity(context.Background(), roomID) }()
	} else {
		messageID = uuid.New().String()
		timestamp = protocol.NewEnvelopeTimestamp()
	}

	msg := protocol.IncomingRoomMessage{
		MessageID: messageID,
		RoomID:    roomID,
		From:      from.Username,
		FromID:    senderID,
		Content:   content,
		Timestamp: timestamp,
	}

	// Send to all members including sender
	// Room members are tracked by UserID, need to look up connection by UserID
	for _, memberUserID := range r.MemberList() {
		if clientID, ok := h.userIDs[memberUserID]; ok {
			if c, ok := h.clients[clientID]; ok {
				_ = c.SendMessage(protocol.TypeRoomMessage, msg)
			}
		}
	}

	return nil
}

// GetRoom returns a room by ID
func (h *Hub) GetRoom(roomID string) *room.Room {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[roomID]
}

// GetRoomHistory retrieves message history for a room
func (h *Hub) GetRoomHistory(c *client.Client, roomID string, limit int, before time.Time) (*protocol.RoomHistoryResponsePayload, error) {
	if c.Username == "" {
		return nil, &Error{Code: protocol.ErrCodeNotRegistered, Message: "Must register first"}
	}

	// Use database UserID for membership check, fall back to connection ID
	memberID := c.UserID
	if memberID == "" {
		memberID = c.ID
	}

	if h.messageStore == nil {
		return &protocol.RoomHistoryResponsePayload{
			RoomID:   roomID,
			Messages: []protocol.IncomingRoomMessage{},
			HasMore:  false,
		}, nil
	}

	ctx := context.Background()

	h.mu.RLock()
	r, exists := h.rooms[roomID]
	if !exists {
		h.mu.RUnlock()
		return nil, &Error{Code: protocol.ErrCodeRoomNotFound, Message: "Room not found"}
	}

	if !r.HasMember(memberID) {
		h.mu.RUnlock()
		return nil, &Error{Code: protocol.ErrCodeNotInRoom, Message: "Not in room"}
	}
	h.mu.RUnlock()

	// Default limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	// Fetch one extra to detect if there are more messages
	messages, err := h.messageStore.GetHistory(ctx, roomID, limit+1, before)
	if err != nil {
		log.Printf("Failed to get room history: %v", err)
		return nil, &Error{Code: protocol.ErrCodeInvalidMessage, Message: "Failed to fetch history"}
	}

	hasMore := len(messages) > limit
	if hasMore {
		messages = messages[:limit]
	}

	// Convert to protocol messages (reverse order so oldest is first)
	protoMessages := make([]protocol.IncomingRoomMessage, len(messages))
	for i, msg := range messages {
		// Messages are returned newest first, reverse them
		protoMessages[len(messages)-1-i] = protocol.IncomingRoomMessage{
			MessageID: msg.ID,
			RoomID:    msg.RoomID,
			From:      msg.SenderUsername,
			FromID:    msg.SenderID,
			Content:   msg.Content,
			Timestamp: msg.CreatedAt.UnixMilli(),
		}
	}

	return &protocol.RoomHistoryResponsePayload{
		RoomID:   roomID,
		Messages: protoMessages,
		HasMore:  hasMore,
	}, nil
}

// broadcastLocked sends a message to all registered clients except excludeID
// Must be called with h.mu held
func (h *Hub) broadcastLocked(excludeID string, msgType protocol.MessageType, payload interface{}) {
	for id, c := range h.clients {
		if id != excludeID && c.Username != "" {
			_ = c.SendMessage(msgType, payload)
		}
	}
}

// broadcastToRoomLocked sends a message to all room members except excludeID (connection ID)
// Must be called with h.mu held
func (h *Hub) broadcastToRoomLocked(roomID, excludeConnID string, msgType protocol.MessageType, payload interface{}) {
	r, exists := h.rooms[roomID]
	if !exists {
		return
	}

	// Room members are tracked by database UserID
	for _, memberUserID := range r.MemberList() {
		if clientID, ok := h.userIDs[memberUserID]; ok {
			if clientID != excludeConnID {
				if c, ok := h.clients[clientID]; ok {
					_ = c.SendMessage(msgType, payload)
				}
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
