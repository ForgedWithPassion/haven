//go:build integration

package postgres

import (
	"context"
	"testing"
	"time"
)

func TestRoomStore_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create a user first (needed as creator)
	user, err := userStore.Create(ctx, "creator", "fp", "rc")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Create a room
	room, err := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)
	if err != nil {
		t.Fatalf("Failed to create room: %v", err)
	}

	if room.ID == "" {
		t.Error("Expected room ID to be set")
	}
	if room.Name != "Test Room" {
		t.Errorf("Expected name 'Test Room', got '%s'", room.Name)
	}
	if room.CreatorID != user.ID {
		t.Errorf("Expected creator ID '%s', got '%s'", user.ID, room.CreatorID)
	}
	if room.CreatorUsername != user.Username {
		t.Errorf("Expected creator username '%s', got '%s'", user.Username, room.CreatorUsername)
	}
	if !room.IsPublic {
		t.Error("Expected room to be public")
	}
	if room.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
	if room.LastActivityAt.IsZero() {
		t.Error("Expected LastActivityAt to be set")
	}
}

func TestRoomStore_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	created, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Get by ID
	room, err := roomStore.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to get room: %v", err)
	}
	if room == nil {
		t.Fatal("Expected to find room")
	}
	if room.Name != "Test Room" {
		t.Errorf("Expected name 'Test Room', got '%s'", room.Name)
	}

	// Get non-existent room
	room, err = roomStore.GetByID(ctx, "00000000-0000-0000-0000-000000000000")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if room != nil {
		t.Error("Expected nil for non-existent room")
	}
}

func TestRoomStore_GetAll(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and rooms
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	_, _ = roomStore.Create(ctx, "Room 1", user.ID, user.Username, true)
	_, _ = roomStore.Create(ctx, "Room 2", user.ID, user.Username, false)

	// Get all rooms
	rooms, err := roomStore.GetAll(ctx)
	if err != nil {
		t.Fatalf("Failed to get all rooms: %v", err)
	}
	if len(rooms) != 2 {
		t.Errorf("Expected 2 rooms, got %d", len(rooms))
	}
}

func TestRoomStore_GetPublic(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and rooms
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	_, _ = roomStore.Create(ctx, "Public Room", user.ID, user.Username, true)
	_, _ = roomStore.Create(ctx, "Private Room", user.ID, user.Username, false)

	// Get public rooms only
	rooms, err := roomStore.GetPublic(ctx)
	if err != nil {
		t.Fatalf("Failed to get public rooms: %v", err)
	}
	if len(rooms) != 1 {
		t.Errorf("Expected 1 public room, got %d", len(rooms))
	}
	if rooms[0].Name != "Public Room" {
		t.Errorf("Expected 'Public Room', got '%s'", rooms[0].Name)
	}
}

func TestRoomStore_UpdateActivity(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	created, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	originalActivity := created.LastActivityAt

	// Wait a bit
	time.Sleep(10 * time.Millisecond)

	// Update activity
	err := roomStore.UpdateActivity(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to update activity: %v", err)
	}

	// Get room and check activity was updated
	room, _ := roomStore.GetByID(ctx, created.ID)
	if !room.LastActivityAt.After(originalActivity) {
		t.Error("Expected LastActivityAt to be updated")
	}
}

func TestRoomStore_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	created, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Delete room
	err := roomStore.Delete(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to delete room: %v", err)
	}

	// Verify room is gone
	room, _ := roomStore.GetByID(ctx, created.ID)
	if room != nil {
		t.Error("Expected room to be deleted")
	}
}

func TestRoomStore_Count(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Initially zero
	count, err := roomStore.Count(ctx)
	if err != nil {
		t.Fatalf("Failed to count rooms: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 rooms, got %d", count)
	}

	// Create user and rooms
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	_, _ = roomStore.Create(ctx, "Room 1", user.ID, user.Username, true)
	_, _ = roomStore.Create(ctx, "Room 2", user.ID, user.Username, false)

	// Check count
	count, err = roomStore.Count(ctx)
	if err != nil {
		t.Fatalf("Failed to count rooms: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2 rooms, got %d", count)
	}
}

func TestRoomStore_CleanupInactive(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "creator", "fp", "rc")
	_, _ = roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Cleanup with long threshold (should delete nothing)
	deleted, err := roomStore.CleanupInactive(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to cleanup: %v", err)
	}
	if deleted != 0 {
		t.Errorf("Expected 0 deleted, got %d", deleted)
	}

	// Cleanup with zero threshold (should delete all)
	deleted, err = roomStore.CleanupInactive(ctx, 0)
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
