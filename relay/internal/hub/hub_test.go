package hub

import (
	"testing"

	"haven/internal/client"
	"haven/internal/protocol"
)

// mockClient creates a test client without a real WebSocket connection
func mockClient(id string) *client.Client {
	return client.NewMock(id)
}

// registerUser is a helper that calls RegisterUser and checks for success
func registerUser(t *testing.T, h *Hub, c *client.Client, username string) {
	t.Helper()
	result := h.RegisterUser(c, username, "", "")
	if result.Error != nil {
		t.Fatalf("Expected successful registration, got error: %v", result.Error)
	}
}

func TestHub_RegisterUser(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	h.AddClient(c1)

	// Test successful registration
	result := h.RegisterUser(c1, "alice", "", "")
	if result.Error != nil {
		t.Fatalf("Expected successful registration, got error: %v", result.Error)
	}
	if c1.Username != "alice" {
		t.Errorf("Expected username 'alice', got '%s'", c1.Username)
	}

	// Test duplicate username rejection (without user storage, it's just in-memory check)
	c2 := mockClient("client-2")
	h.AddClient(c2)
	result = h.RegisterUser(c2, "alice", "", "")
	if result.Error == nil {
		t.Fatal("Expected error for duplicate username, got nil")
	}
	if result.Error.Code != protocol.ErrCodeUsernameInUse {
		t.Errorf("Expected error code '%s', got '%s'", protocol.ErrCodeUsernameInUse, result.Error.Code)
	}

	// Test invalid username
	c3 := mockClient("client-3")
	h.AddClient(c3)
	result = h.RegisterUser(c3, "ab", "", "") // Too short
	if result.Error == nil {
		t.Fatal("Expected error for short username, got nil")
	}
	if result.Error.Code != protocol.ErrCodeInvalidUsername {
		t.Errorf("Expected error code '%s', got '%s'", protocol.ErrCodeInvalidUsername, result.Error.Code)
	}
}

func TestHub_GetUserList(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	c2 := mockClient("client-2")
	h.AddClient(c1)
	h.AddClient(c2)

	registerUser(t, h, c1, "alice")
	registerUser(t, h, c2, "bob")

	users := h.GetUserList()
	if len(users) != 2 {
		t.Fatalf("Expected 2 users, got %d", len(users))
	}

	usernames := make(map[string]bool)
	for _, u := range users {
		usernames[u.Username] = true
	}
	if !usernames["alice"] || !usernames["bob"] {
		t.Errorf("Expected alice and bob in user list, got %v", users)
	}
}

func TestHub_CreateRoom(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	h.AddClient(c1)

	// Must register first
	_, err := h.CreateRoom(c1, "General", true)
	if err == nil {
		t.Fatal("Expected error for unregistered user, got nil")
	}

	registerUser(t, h, c1, "alice")

	// Create room successfully
	room, err := h.CreateRoom(c1, "General", true)
	if err != nil {
		t.Fatalf("Expected successful room creation, got error: %v", err)
	}
	if room.Name != "General" {
		t.Errorf("Expected room name 'General', got '%s'", room.Name)
	}
	if !room.IsPublic {
		t.Error("Expected room to be public")
	}
	if room.Creator != "alice" {
		t.Errorf("Expected creator 'alice', got '%s'", room.Creator)
	}
	if room.MemberCount() != 1 {
		t.Errorf("Expected 1 member (creator), got %d", room.MemberCount())
	}
}

func TestHub_JoinLeaveRoom(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	c2 := mockClient("client-2")
	h.AddClient(c1)
	h.AddClient(c2)
	registerUser(t, h, c1, "alice")
	registerUser(t, h, c2, "bob")

	// Alice creates a room
	room, _ := h.CreateRoom(c1, "General", true)

	// Bob joins the room
	joinedRoom, err := h.JoinRoom(c2, room.ID)
	if err != nil {
		t.Fatalf("Expected successful join, got error: %v", err)
	}
	if joinedRoom.MemberCount() != 2 {
		t.Errorf("Expected 2 members, got %d", joinedRoom.MemberCount())
	}

	// Bob tries to join again
	_, err = h.JoinRoom(c2, room.ID)
	if err == nil {
		t.Fatal("Expected error for already in room, got nil")
	}

	// Bob leaves the room
	err = h.LeaveRoom(c2, room.ID)
	if err != nil {
		t.Fatalf("Expected successful leave, got error: %v", err)
	}
	if room.MemberCount() != 1 {
		t.Errorf("Expected 1 member after leave, got %d", room.MemberCount())
	}

	// Alice leaves, room should still exist (persisted rooms are not deleted immediately)
	err = h.LeaveRoom(c1, room.ID)
	if err != nil {
		t.Fatalf("Expected successful leave, got error: %v", err)
	}
	emptyRoom := h.GetRoom(room.ID)
	if emptyRoom == nil {
		t.Error("Expected room to still exist (rooms are persisted)")
	} else if emptyRoom.MemberCount() != 0 {
		t.Errorf("Expected 0 members in empty room, got %d", emptyRoom.MemberCount())
	}
}

func TestHub_GetRoomList(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	c2 := mockClient("client-2")
	h.AddClient(c1)
	h.AddClient(c2)
	registerUser(t, h, c1, "alice")
	registerUser(t, h, c2, "bob")

	// Alice creates a public room
	_, _ = h.CreateRoom(c1, "Public Room", true)

	// Alice creates a private room
	_, _ = h.CreateRoom(c1, "Private Room", false)

	// Bob should only see the public room
	bobRooms := h.GetRoomList(c2)
	if len(bobRooms) != 1 {
		t.Fatalf("Expected 1 room for bob, got %d", len(bobRooms))
	}
	if bobRooms[0].Name != "Public Room" {
		t.Errorf("Expected 'Public Room', got '%s'", bobRooms[0].Name)
	}

	// Alice should see both rooms
	aliceRooms := h.GetRoomList(c1)
	if len(aliceRooms) != 2 {
		t.Fatalf("Expected 2 rooms for alice, got %d", len(aliceRooms))
	}
}

func TestHub_RemoveClient(t *testing.T) {
	h := New()

	c1 := mockClient("client-1")
	c2 := mockClient("client-2")
	h.AddClient(c1)
	h.AddClient(c2)
	registerUser(t, h, c1, "alice")
	registerUser(t, h, c2, "bob")

	// Alice creates a room, bob joins
	room, _ := h.CreateRoom(c1, "General", true)
	_, _ = h.JoinRoom(c2, room.ID)

	// Remove alice (disconnect)
	h.RemoveClient(c1)

	// Room should still exist with bob
	updatedRoom := h.GetRoom(room.ID)
	if updatedRoom == nil {
		t.Fatal("Expected room to still exist")
	}
	if updatedRoom.MemberCount() != 1 {
		t.Errorf("Expected 1 member, got %d", updatedRoom.MemberCount())
	}

	// Alice's username should be available again
	c3 := mockClient("client-3")
	h.AddClient(c3)
	registerUser(t, h, c3, "alice") // Should succeed since Alice disconnected
}
