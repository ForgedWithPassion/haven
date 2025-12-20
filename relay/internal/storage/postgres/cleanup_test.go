package postgres

import (
	"context"
	"testing"
	"time"
)

func TestCleanup_InactiveUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	cleanup := NewCleanup(testDB.Pool)
	ctx := context.Background()

	// Create a user
	_, _ = userStore.Create(ctx, "testuser", "fp", "rc")

	// Cleanup with long threshold (should delete nothing)
	deleted, err := cleanup.InactiveUsers(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 0 {
		t.Errorf("Expected 0 deleted, got %d", deleted)
	}

	// Verify user still exists
	count, _ := userStore.Count(ctx)
	if count != 1 {
		t.Errorf("Expected 1 user, got %d", count)
	}

	// Cleanup with zero threshold (should delete all)
	deleted, err = cleanup.InactiveUsers(ctx, 0)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 1 {
		t.Errorf("Expected 1 deleted, got %d", deleted)
	}

	// Verify user is gone
	count, _ = userStore.Count(ctx)
	if count != 0 {
		t.Errorf("Expected 0 users after cleanup, got %d", count)
	}
}

func TestCleanup_InactiveRooms(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	cleanup := NewCleanup(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	_, _ = roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Cleanup with long threshold (should delete nothing)
	deleted, err := cleanup.InactiveRooms(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 0 {
		t.Errorf("Expected 0 deleted, got %d", deleted)
	}

	// Cleanup with zero threshold (should delete all)
	deleted, err = cleanup.InactiveRooms(ctx, 0)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 1 {
		t.Errorf("Expected 1 deleted, got %d", deleted)
	}

	// Verify room is gone
	count, _ := roomStore.Count(ctx)
	if count != 0 {
		t.Errorf("Expected 0 rooms after cleanup, got %d", count)
	}
}

func TestCleanup_OldMessages(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	cleanup := NewCleanup(testDB.Pool)
	ctx := context.Background()

	// Create user, room, and messages
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Hello!")

	// Cleanup with long threshold (should delete nothing)
	deleted, err := cleanup.OldMessages(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 0 {
		t.Errorf("Expected 0 deleted, got %d", deleted)
	}

	// Verify message still exists
	count, _ := messageStore.CountInRoom(ctx, room.ID)
	if count != 1 {
		t.Errorf("Expected 1 message, got %d", count)
	}

	// Cleanup with zero threshold (should delete all)
	deleted, err = cleanup.OldMessages(ctx, 0)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 1 {
		t.Errorf("Expected 1 deleted, got %d", deleted)
	}

	// Verify message is gone
	count, _ = messageStore.CountInRoom(ctx, room.ID)
	if count != 0 {
		t.Errorf("Expected 0 messages after cleanup, got %d", count)
	}
}

func TestCleanup_RunAll(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	messageStore := NewMessageStore(testDB.Pool)
	cleanup := NewCleanup(testDB.Pool)
	ctx := context.Background()

	// Create user, room, and messages
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)
	_, _ = messageStore.Save(ctx, room.ID, user.ID, user.Username, "Hello!")

	// Run all cleanups with long thresholds (should delete nothing)
	stats, err := cleanup.RunAll(ctx, CleanupConfig{
		UserInactivityTimeout: 24 * time.Hour,
		RoomInactivityTimeout: 24 * time.Hour,
		MessageRetention:      24 * time.Hour,
	})
	if err != nil {
		t.Fatalf("Failed to run cleanup: %v", err)
	}
	if stats.UsersDeleted != 0 || stats.RoomsDeleted != 0 || stats.MessagesDeleted != 0 {
		t.Errorf("Expected no deletions, got users=%d, rooms=%d, messages=%d",
			stats.UsersDeleted, stats.RoomsDeleted, stats.MessagesDeleted)
	}

	// Run all cleanups with zero thresholds (should delete everything)
	stats, err = cleanup.RunAll(ctx, CleanupConfig{
		UserInactivityTimeout: 0,
		RoomInactivityTimeout: 0,
		MessageRetention:      0,
	})
	if err != nil {
		t.Fatalf("Failed to run cleanup: %v", err)
	}

	// Room should be deleted, cascade deletes messages
	// User might have dependent rooms so order matters
	if stats.RoomsDeleted < 1 {
		t.Errorf("Expected at least 1 room deleted, got %d", stats.RoomsDeleted)
	}
}
