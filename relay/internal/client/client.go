package client

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"haven/internal/protocol"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = 54 * time.Second

	// Maximum message size allowed from peer
	maxMessageSize = 8192

	// Send buffer size
	sendBufferSize = 256
)

// Client represents a connected WebSocket user
type Client struct {
	ID       string
	Username string
	Conn     *websocket.Conn
	Send     chan []byte
	rooms    map[string]bool // Set of room IDs
	mu       sync.RWMutex

	// Handler is called for each incoming message
	Handler func(c *Client, env *protocol.Envelope)
	// OnClose is called when the client disconnects
	OnClose func(c *Client)
}

// New creates a new client
func New(id string, conn *websocket.Conn) *Client {
	return &Client{
		ID:    id,
		Conn:  conn,
		Send:  make(chan []byte, sendBufferSize),
		rooms: make(map[string]bool),
	}
}

// NewMock creates a mock client for testing (no WebSocket connection)
func NewMock(id string) *Client {
	return &Client{
		ID:    id,
		Send:  make(chan []byte, sendBufferSize),
		rooms: make(map[string]bool),
	}
}

// JoinRoom adds a room to the client's room set
func (c *Client) JoinRoom(roomID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.rooms[roomID] = true
}

// LeaveRoom removes a room from the client's room set
func (c *Client) LeaveRoom(roomID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.rooms, roomID)
}

// IsInRoom checks if client is in a room
func (c *Client) IsInRoom(roomID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.rooms[roomID]
}

// Rooms returns a copy of the client's room IDs
func (c *Client) Rooms() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]string, 0, len(c.rooms))
	for id := range c.rooms {
		result = append(result, id)
	}
	return result
}

// SendMessage sends a protocol message to the client
func (c *Client) SendMessage(msgType protocol.MessageType, payload interface{}) error {
	env, err := protocol.NewEnvelope(msgType, payload)
	if err != nil {
		return err
	}
	data, err := json.Marshal(env)
	if err != nil {
		return err
	}
	select {
	case c.Send <- data:
		return nil
	default:
		return nil // Drop if buffer full
	}
}

// SendError sends an error message to the client
func (c *Client) SendError(code, message string) {
	c.SendMessage(protocol.TypeError, protocol.ErrorPayload{
		Code:    code,
		Message: message,
	})
}

// SendErrorWithTarget sends an error message with a target identifier (e.g., username for DM errors)
func (c *Client) SendErrorWithTarget(code, message, target string) {
	c.SendMessage(protocol.TypeError, protocol.ErrorPayload{
		Code:    code,
		Message: message,
		Target:  target,
	})
}

// ReadPump handles incoming WebSocket messages
func (c *Client) ReadPump() {
	defer func() {
		if c.OnClose != nil {
			c.OnClose(c)
		}
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for %s: %v", c.ID, err)
			}
			break
		}

		var env protocol.Envelope
		if err := json.Unmarshal(message, &env); err != nil {
			c.SendError(protocol.ErrCodeInvalidMessage, "Invalid JSON")
			continue
		}

		if c.Handler != nil {
			c.Handler(c, &env)
		}
	}
}

// WritePump handles outgoing WebSocket messages
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Close closes the client connection
func (c *Client) Close() {
	close(c.Send)
}
