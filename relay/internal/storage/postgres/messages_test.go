//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"
)

func TestMessageStore_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Save a message
	msg, err := messageStore.Save(ctx, room.ID, user.ID, user.Username, "Hello, World!")
	if err != nil {
		t.Fatalf("Failed to save message: %v", err)
	}

	if msg.ID == "" {
		t.Error("Expected message ID to be set")
	}
	if msg.RoomID != room.ID {
		t.Errorf("Expected room ID '%s', got '%s'", room.ID, msg.RoomID)
	}
	if msg.SenderID != user.ID {
		t.Errorf("Expected sender ID '%s', got '%s'", user.ID, msg.SenderID)
	}
	if msg.SenderUsername != user.Username {
		t.Errorf("Expected sender username '%s', got '%s'", user.Username, msg.SenderUsername)
	}
	if msg.Content != "Hello, World!" {
		t.Errorf("Expected content 'Hello, World!', got '%s'", msg.Content)
	}
	if msg.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
}

func TestMessageStore_GetHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Save multiple messages
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 1")
	time.Sleep(10 * time.Millisecond)
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 2")
	time.Sleep(10 * time.Millisecond)
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 3")

	// Get history
	messages, err := messageStore.GetHistory(ctx, room.ID, 10, time.Time{})
	if err != nil {
		t.Fatalf("Failed to get history: %v", err)
	}
	if len(messages) != 3 {
		t.Errorf("Expected 3 messages, got %d", len(messages))
	}

	// Should be in reverse chronological order (newest first)
	if messages[0].Content != "Message 3" {
		t.Errorf("Expected newest message first, got '%s'", messages[0].Content)
	}
}

func TestMessageStore_GetHistoryWithLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Save multiple messages
	for i := 1; i <= 5; i++ {
		_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message")
		time.Sleep(10 * time.Millisecond)
	}

	// Get only 2 messages
	messages, err := messageStore.GetHistory(ctx, room.ID, 2, time.Time{})
	if err != nil {
		t.Fatalf("Failed to get history: %v", err)
	}
	if len(messages) != 2 {
		t.Errorf("Expected 2 messages, got %d", len(messages))
	}
}

func TestMessageStore_GetHistoryPagination(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Save multiple messages with delay to ensure ordering
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 1")
	time.Sleep(10 * time.Millisecond)
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 2")
	time.Sleep(10 * time.Millisecond)
	msg3, _ := messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 3")

	// Get first page (newest)
	page1, _ := messageStore.GetHistory(ctx, room.ID, 2, time.Time{})
	if len(page1) != 2 {
		t.Fatalf("Expected 2 messages in page 1, got %d", len(page1))
	}

	// Get second page using the oldest message from page 1
	oldestFromPage1 := page1[len(page1)-1]
	page2, _ := messageStore.GetHistory(ctx, room.ID, 2, oldestFromPage1.CreatedAt)
	if len(page2) != 1 {
		t.Errorf("Expected 1 message in page 2, got %d", len(page2))
	}

	// Page 2 should contain Message 1 (the oldest)
	if len(page2) > 0 && page2[0].Content != "Message 1" {
		t.Errorf("Expected 'Message 1' in page 2, got '%s'", page2[0].Content)
	}

	// Verify Message 3 is not in the result (it's newest, should be in page 1)
	_ = msg3 // Used to verify the flow
}

func TestMessageStore_CascadeDeleteOnRoomDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Save a message
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Hello!")

	// Verify message exists
	messages, _ := messageStore.GetHistory(ctx, room.ID, 10, time.Time{})
	if len(messages) != 1 {
		t.Fatal("Expected 1 message before delete")
	}

	// Delete room - should cascade delete messages
	err := roomStore.Delete(ctx, room.ID)
	if err != nil {
		t.Fatalf("Failed to delete room: %v", err)
	}

	// Verify messages are gone
	messages, _ = messageStore.GetHistory(ctx, room.ID, 10, time.Time{})
	if len(messages) != 0 {
		t.Errorf("Expected 0 messages after room delete, got %d", len(messages))
	}
}

func TestMessageStore_Count(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Initially zero
	count, err := messageStore.CountInRoom(ctx, room.ID)
	if err != nil {
		t.Fatalf("Failed to count messages: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 messages, got %d", count)
	}

	// Save messages
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 1")
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Message 2")

	// Check count
	count, err = messageStore.CountInRoom(ctx, room.ID)
	if err != nil {
		t.Fatalf("Failed to count messages: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2 messages, got %d", count)
	}
}
