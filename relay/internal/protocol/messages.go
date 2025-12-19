package protocol

import (
	"encoding/json"
	"time"
)

// MessageType identifies the type of message
type MessageType string

const (
	// Client -> Server
	TypeRegister    MessageType = "register"
	TypeDirectMsg   MessageType = "direct_message"
	TypeRoomCreate  MessageType = "room_create"
	TypeRoomJoin    MessageType = "room_join"
	TypeRoomLeave   MessageType = "room_leave"
	TypeRoomMessage MessageType = "room_message"
	TypeUserList    MessageType = "user_list"
	TypeRoomList    MessageType = "room_list"

	// Server -> Client
	TypeRegisterAck  MessageType = "register_ack"
	TypeKicked       MessageType = "kicked"
	TypeUserJoined   MessageType = "user_joined"
	TypeUserLeft     MessageType = "user_left"
	TypeRoomCreated  MessageType = "room_created"
	TypeRoomJoined   MessageType = "room_joined"
	TypeRoomLeft     MessageType = "room_left"
	TypeRoomMembers  MessageType = "room_members"
	TypeUserListResp MessageType = "user_list_response"
	TypeRoomListResp MessageType = "room_list_response"
	TypeError        MessageType = "error"
)

// Envelope is the base message wrapper
type Envelope struct {
	Type      MessageType     `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp"`
}

// NewEnvelope creates a new envelope with the current timestamp
func NewEnvelope(msgType MessageType, payload interface{}) (*Envelope, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return &Envelope{
		Type:      msgType,
		Payload:   data,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

// NewEnvelopeTimestamp returns the current timestamp in milliseconds
func NewEnvelopeTimestamp() int64 {
	return time.Now().UnixMilli()
}

// ==================== Client -> Server Messages ====================

// RegisterPayload - register username with optional fingerprint/recovery
type RegisterPayload struct {
	Username     string `json:"username"`
	Fingerprint  string `json:"fingerprint,omitempty"`
	RecoveryCode string `json:"recovery_code,omitempty"`
}

// DirectMessagePayload - send DM to another user
type DirectMessagePayload struct {
	To      string `json:"to"` // Target username
	Content string `json:"content"`
}

// RoomCreatePayload - create a new room
type RoomCreatePayload struct {
	Name     string `json:"name"`
	IsPublic bool   `json:"is_public"`
}

// RoomJoinPayload - join an existing room
type RoomJoinPayload struct {
	RoomID string `json:"room_id"`
}

// RoomLeavePayload - leave a room
type RoomLeavePayload struct {
	RoomID string `json:"room_id"`
}

// RoomMessagePayload - send message to room
type RoomMessagePayload struct {
	RoomID  string `json:"room_id"`
	Content string `json:"content"`
}

// ==================== Server -> Client Messages ====================

// RegisterAckPayload - registration acknowledgment
type RegisterAckPayload struct {
	Success      bool   `json:"success"`
	Username     string `json:"username,omitempty"`
	UserID       string `json:"user_id,omitempty"`
	RecoveryCode string `json:"recovery_code,omitempty"` // Only for new users
	IsNewUser    bool   `json:"is_new_user,omitempty"`
	Error        string `json:"error,omitempty"`
}

// KickedPayload - notification when user is kicked (imposter detection)
type KickedPayload struct {
	Reason string `json:"reason"`
}

// UserJoinedPayload - notification when user comes online
type UserJoinedPayload struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// UserLeftPayload - notification when user goes offline
type UserLeftPayload struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// RoomCreatedPayload - room creation response
type RoomCreatedPayload struct {
	Success bool      `json:"success"`
	Room    *RoomInfo `json:"room,omitempty"`
	Error   string    `json:"error,omitempty"`
}

// RoomJoinedPayload - room join response
type RoomJoinedPayload struct {
	Success bool       `json:"success"`
	RoomID  string     `json:"room_id,omitempty"` // Always included, even on failure
	Room    *RoomInfo  `json:"room,omitempty"`
	Members []UserInfo `json:"members,omitempty"`
	Error   string     `json:"error,omitempty"`
}

// RoomLeftPayload - room leave response
type RoomLeftPayload struct {
	Success bool   `json:"success"`
	RoomID  string `json:"room_id"`
	Error   string `json:"error,omitempty"`
}

// RoomMembersPayload - room member update (join/leave notification)
type RoomMembersPayload struct {
	RoomID  string     `json:"room_id"`
	Action  string     `json:"action"` // "joined" or "left"
	User    UserInfo   `json:"user"`
	Members []UserInfo `json:"members"`
}

// IncomingDirectMessage - received direct message
type IncomingDirectMessage struct {
	MessageID string `json:"message_id"`
	From      string `json:"from"`    // Username
	FromID    string `json:"from_id"` // User ID
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// IncomingRoomMessage - received room message
type IncomingRoomMessage struct {
	MessageID string `json:"message_id"`
	RoomID    string `json:"room_id"`
	From      string `json:"from"`    // Username
	FromID    string `json:"from_id"` // User ID
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
}

// UserListResponsePayload - list of online users
type UserListResponsePayload struct {
	Users []UserInfo `json:"users"`
}

// RoomListResponsePayload - list of rooms
type RoomListResponsePayload struct {
	Rooms []RoomInfo `json:"rooms"`
}

// ErrorPayload - error response
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Target  string `json:"target,omitempty"` // Target username for DM errors
}

// ==================== Shared Types ====================

// UserInfo - public user information
type UserInfo struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// RoomInfo - public room information
type RoomInfo struct {
	RoomID      string `json:"room_id"`
	Name        string `json:"name"`
	Creator     string `json:"creator"` // Username
	CreatorID   string `json:"creator_id"`
	MemberCount int    `json:"member_count"`
	IsPublic    bool   `json:"is_public"`
}

// ==================== Error Codes ====================

const (
	ErrCodeUsernameInUse    = "USERNAME_IN_USE"
	ErrCodeInvalidUsername  = "INVALID_USERNAME"
	ErrCodeNotRegistered    = "NOT_REGISTERED"
	ErrCodeRoomNotFound     = "ROOM_NOT_FOUND"
	ErrCodeNotInRoom        = "NOT_IN_ROOM"
	ErrCodeAlreadyInRoom    = "ALREADY_IN_ROOM"
	ErrCodeUserNotFound     = "USER_NOT_FOUND"
	ErrCodeInvalidMessage   = "INVALID_MESSAGE"
	ErrCodeInvalidRoomName  = "INVALID_ROOM_NAME"
	ErrCodeRecoveryRequired = "RECOVERY_REQUIRED"
	ErrCodeInvalidRecovery  = "INVALID_RECOVERY"
)
