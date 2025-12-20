package main

import (
	"context"
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
	"haven/internal/storage/postgres"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	// Initialize PostgreSQL database
	dbCfg := &postgres.Config{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		Database: cfg.DB.Database,
		SSLMode:  cfg.DB.SSLMode,
		MaxConns: int32(cfg.DB.MaxConns),
		MinConns: int32(cfg.DB.MinConns),
	}

	db, err := postgres.NewDB(ctx, dbCfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Printf("Connected to PostgreSQL at %s:%s/%s", cfg.DB.Host, cfg.DB.Port, cfg.DB.Database)

	// Run database migrations
	if err := db.RunMigrations(); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}
	log.Printf("Database migrations applied successfully")

	// Create stores
	userStore := postgres.NewUserStore(db.Pool)
	roomStore := postgres.NewRoomStore(db.Pool)
	memberStore := postgres.NewMemberStore(db.Pool)
	messageStore := postgres.NewMessageStore(db.Pool)

	// Get initial counts for logging
	userCount, _ := userStore.Count(ctx)
	roomCount, _ := roomStore.Count(ctx)
	log.Printf("Database initialized: %d users, %d rooms", userCount, roomCount)

	// Create hub and set storage
	h := hub.New()
	h.SetStores(roomStore, userStore, memberStore, messageStore)

	// Load persisted rooms
	if err := h.LoadRooms(); err != nil {
		log.Printf("Warning: Failed to load rooms from storage: %v", err)
	}

	// Start cleanup job
	cleanupJob := postgres.NewCleanupJob(db.Pool, postgres.CleanupConfig{
		UserInactivityTimeout: cfg.UserInactivityTimeout,
		RoomInactivityTimeout: cfg.RoomInactivityTimeout,
		MessageRetention:      cfg.MessageRetention,
	}, cfg.CleanupInterval)
	cleanupJob.Start()
	defer cleanupJob.Stop()
	log.Printf("Cleanup job started (interval: %v, user timeout: %v, room timeout: %v, message retention: %v)",
		cfg.CleanupInterval, cfg.UserInactivityTimeout, cfg.RoomInactivityTimeout, cfg.MessageRetention)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(h, w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		uc, _ := userStore.Count(ctx)
		rc, _ := roomStore.Count(ctx)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":     "healthy",
			"room_count": strconv.Itoa(rc),
			"user_count": strconv.Itoa(uc),
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
	case protocol.TypeRoomHistory:
		handleRoomHistory(h, c, env.Payload)
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

	// Use database UserID for consistency with room membership
	userID := c.UserID
	if userID == "" {
		userID = c.ID // Fallback for non-DB mode
	}

	_ = c.SendMessage(protocol.TypeRegisterAck, protocol.RegisterAckPayload{
		Success:      true,
		Username:     c.Username,
		UserID:       userID,
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

	// Fetch recent message history to include in join response
	var history []protocol.IncomingRoomMessage
	historyResp, err := h.GetRoomHistory(c, room.ID, 50, time.Time{})
	if err == nil && historyResp != nil {
		history = historyResp.Messages
	}

	_ = c.SendMessage(protocol.TypeRoomJoined, protocol.RoomJoinedPayload{
		Success: true,
		RoomID:  room.ID,
		Room:    &roomInfo,
		Members: room.MemberInfoList(),
		History: history,
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

func handleRoomHistory(h *hub.Hub, c *client.Client, payload json.RawMessage) {
	var p protocol.RoomHistoryPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		c.SendError(protocol.ErrCodeInvalidMessage, "Invalid room history payload")
		return
	}

	var before time.Time
	if p.Before > 0 {
		before = time.UnixMilli(p.Before)
	}

	response, err := h.GetRoomHistory(c, p.RoomID, p.Limit, before)
	if err != nil {
		if hubErr, ok := err.(*hub.Error); ok {
			c.SendError(hubErr.Code, hubErr.Message)
		}
		return
	}

	_ = c.SendMessage(protocol.TypeRoomHistoryResp, response)
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
