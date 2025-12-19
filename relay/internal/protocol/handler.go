package protocol

import (
	"encoding/json"
)

// MessageHandler handles a specific message type
type MessageHandler func(payload json.RawMessage) error

// Registry maps message types to handlers
type Registry struct {
	handlers map[MessageType]MessageHandler
}

// NewRegistry creates a new handler registry
func NewRegistry() *Registry {
	return &Registry{
		handlers: make(map[MessageType]MessageHandler),
	}
}

// Register adds a handler for a message type
func (r *Registry) Register(msgType MessageType, handler MessageHandler) {
	r.handlers[msgType] = handler
}

// Handle dispatches a message to the appropriate handler
func (r *Registry) Handle(env *Envelope) error {
	handler, ok := r.handlers[env.Type]
	if !ok {
		return nil // Unknown message types are ignored
	}
	return handler(env.Payload)
}

// HasHandler checks if a handler exists for a message type
func (r *Registry) HasHandler(msgType MessageType) bool {
	_, ok := r.handlers[msgType]
	return ok
}
