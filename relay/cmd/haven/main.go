package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"haven/internal/client"
	"haven/internal/config"
	"haven/internal/hub"
	"haven/internal/protocol"
	"haven/internal/storage"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func main() {
	cfg := config.Load()

	// Initialize room storage
	store, err := storage.NewRoomStore(cfg.RoomStoragePath)
	if err != nil {
		log.Fatalf("Failed to initialize room storage: %v", err)
	}
	log.Printf("Room storage initialized at %s", cfg.RoomStoragePath)

	// Initialize user storage
	userStore, err := storage.NewUserStore(cfg.UserStoragePath)
	if err != nil {
		log.Fatalf("Failed to initialize user storage: %v", err)
	}
	log.Printf("User storage initialized at %s (%d users)", cfg.UserStoragePath, userStore.Count())

	// Create hub and set storage
	h := hub.New()
	h.SetStorage(store)
	h.SetUserStorage(userStore)

	// Load persisted rooms
	if err := h.LoadRooms(); err != nil {
		log.Printf("Warning: Failed to load rooms from storage: %v", err)
	}

	// Start cleanup routine
	go func() {
		ticker := time.NewTicker(cfg.CleanupInterval)
		defer ticker.Stop()

		log.Printf("Room cleanup routine started (interval: %v, timeout: %v)", cfg.CleanupInterval, cfg.RoomInactivityTimeout)

		for range ticker.C {
			count, err := h.CleanupInactiveRooms(cfg.RoomInactivityTimeout)
			if err != nil {
				log.Printf("Error during room cleanup: %v", err)
			} else if count > 0 {
				log.Printf("Cleaned up %d inactive rooms", count)
			}
		}
	}()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(h, w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":     "healthy",
			"room_count": strconv.Itoa(store.Count()),
			"user_count": strconv.Itoa(userStore.Count()),
		})
	})

	log.Printf("Haven relay starting on :%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, nil))
}

func serveWs(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	clientID := uuid.New().String()
	c := client.New(clientID, conn)

	// Set up message handler
	c.Handler = func(c *client.Client, env *protocol.Envelope) {
		handleMessage(h, c, env)
	}

	// Set up disconnect handler
	c.OnClose = func(c *client.Client) {
		h.RemoveClient(c)
		log.Printf("Client disconnected: %s (%s)", c.ID, c.Username)
	}

	h.AddClient(c)
	log.Printf("Client connected: %s", c.ID)

	go c.WritePump()
	go c.ReadPump()
}

func handleMessage(h *hub.Hub, c *client.Client, env *protocol.Envelope) {
	switch env.Type {
	case protocol.TypeRegister:
		handleRegister(h, c, env.Payload)
	case protocol.TypeDirectMsg:
		handleDirectMessage(h, c, env.Payload)
	case protocol.TypeRoomCreate:
		handleRoomCreate(h, c, env.Payload)
	case protocol.TypeRoomJoin:
		handleRoomJoin(h, c, env.Payload)
	case protocol.TypeRoomLeave:
		handleRoomLeave(h, c, env.Payload)
	case protocol.TypeRoomMessage:
		handleRoomMessage(h, c, env.Payload)
	case protocol.TypeUserList:
		handleUserList(h, c)
	case protocol.TypeRoomList:
		handleRoomList(h, c)
	default:
		c.SendError(protocol.ErrCodeInvalidMessage, "Unknown message type")
	}
}

func handleRegister(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RegisterPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid register payload")
		return
	}

	result := h.RegisterUser(c, p.Username, p.Fingerprint, p.RecoveryCode)

	if result.Error != nil {
		_ = c.SendMessage(protocol.TypeRegisterAck, protocol.RegisterAckPayload{
			Success: false,
			Error:   result.Error.Code, // Use error code so client can handle specific cases
		})
		return
	}

	_ = c.SendMessage(protocol.TypeRegisterAck, protocol.RegisterAckPayload{
		Success:      true,
		Username:     c.Username,
		UserID:       c.ID,
		RecoveryCode: result.RecoveryCode, // Only set for new users
		IsNewUser:    result.IsNewUser,
	})

	if result.IsNewUser {
		log.Printf("New user registered: %s (%s)", c.Username, c.ID)
	} else {
		log.Printf("User logged in: %s (%s)", c.Username, c.ID)
	}
}

func handleDirectMessage(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.DirectMessagePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid direct message payload")
		return
	}

	if err := h.SendDirectMessage(c, p.To, p.Content); err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			c.SendErrorWithTarget(hubErr.Code, hubErr.Message, p.To)
		}
	}
}

func handleRoomCreate(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RoomCreatePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid room create payload")
		return
	}

	room, err := h.CreateRoom(c, p.Name, p.IsPublic)
	if err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			_ = c.SendMessage(protocol.TypeRoomCreated, protocol.RoomCreatedPayload{
				Success: false,
				Error:   hubErr.Message,
			})
		}
		return
	}

	roomInfo := room.Info()
	_ = c.SendMessage(protocol.TypeRoomCreated, protocol.RoomCreatedPayload{
		Success: true,
		Room:    &roomInfo,
	})
	log.Printf("Room created: %s (%s) by %s", room.Name, room.ID, c.Username)
}

func handleRoomJoin(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RoomJoinPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid room join payload")
		return
	}

	room, err := h.JoinRoom(c, p.RoomID)
	if err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			_ = c.SendMessage(protocol.TypeRoomJoined, protocol.RoomJoinedPayload{
				Success: false,
				RoomID:  p.RoomID, // Include room_id so client can clean up
				Error:   hubErr.Message,
			})
		}
		return
	}

	roomInfo := room.Info()
	_ = c.SendMessage(protocol.TypeRoomJoined, protocol.RoomJoinedPayload{
		Success: true,
		RoomID:  room.ID,
		Room:    &roomInfo,
		Members: room.MemberInfoList(),
	})
	log.Printf("User %s joined room %s", c.Username, room.Name)
}

func handleRoomLeave(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RoomLeavePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid room leave payload")
		return
	}

	if err := h.LeaveRoom(c, p.RoomID); err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			_ = c.SendMessage(protocol.TypeRoomLeft, protocol.RoomLeftPayload{
				Success: false,
				RoomID:  p.RoomID,
				Error:   hubErr.Message,
			})
		}
		return
	}

	_ = c.SendMessage(protocol.TypeRoomLeft, protocol.RoomLeftPayload{
		Success: true,
		RoomID:  p.RoomID,
	})
}

func handleRoomMessage(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RoomMessagePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid room message payload")
		return
	}

	if err := h.SendRoomMessage(c, p.RoomID, p.Content); err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			c.SendError(hubErr.Code, hubErr.Message)
		}
	}
}

func handleUserList(h *hub.Hub, c *client.Client) {
	users := h.GetUserList()
	_ = c.SendMessage(protocol.TypeUserListResp, protocol.UserListResponsePayload{
		Users: users,
	})
}

func handleRoomList(h *hub.Hub, c *client.Client) {
	rooms := h.GetRoomList(c)
	_ = c.SendMessage(protocol.TypeRoomListResp, protocol.RoomListResponsePayload{
		Rooms: rooms,
	})
}
