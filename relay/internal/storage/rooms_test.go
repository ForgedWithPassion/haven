package storage

import (
	"os"
	"testing"
	"time"
)

func TestRoomStore_SaveAndLoad(t *testing.T) {
	// Create temp file
	tmpFile, err := os.CreateTemp("", "rooms_test_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	// Create store
	store, err := NewRoomStore(tmpPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	// Save a room
	now := time.Now()
	room := &RoomData{
		ID:              "room-1",
		Name:            "General",
		CreatorID:       "user-1",
		CreatorUsername: "alice",
		IsPublic:        true,
		CreatedAt:       now,
		LastActivityAt:  now,
	}
	err = store.SaveRoom(room)
	if err != nil {
		t.Fatalf("Failed to save room: %v", err)
	}

	// Verify room count
	if store.Count() != 1 {
		t.Errorf("Expected 1 room, got %d", store.Count())
	}

	// Create a new store that loads from file
	store2, err := NewRoomStore(tmpPath)
	if err != nil {
		t.Fatalf("Failed to create second store: %v", err)
	}

	// Verify room was loaded
	if store2.Count() != 1 {
		t.Errorf("Expected 1 room after reload, got %d", store2.Count())
	}

	loaded := store2.GetRoom("room-1")
	if loaded == nil {
		t.Fatal("Expected to find room-1")
	}
	if loaded.Name != "General" {
		t.Errorf("Expected name 'General', got '%s'", loaded.Name)
	}
}

func TestRoomStore_Delete(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "rooms_test_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	store, err := NewRoomStore(tmpPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	now := time.Now()
	store.SaveRoom(&RoomData{
		ID:             "room-1",
		Name:           "Room 1",
		CreatedAt:      now,
		LastActivityAt: now,
	})
	store.SaveRoom(&RoomData{
		ID:             "room-2",
		Name:           "Room 2",
		CreatedAt:      now,
		LastActivityAt: now,
	})

	if store.Count() != 2 {
		t.Errorf("Expected 2 rooms, got %d", store.Count())
	}

	err = store.DeleteRoom("room-1")
	if err != nil {
		t.Fatalf("Failed to delete room: %v", err)
	}

	if store.Count() != 1 {
		t.Errorf("Expected 1 room after delete, got %d", store.Count())
	}

	if store.GetRoom("room-1") != nil {
		t.Error("Expected room-1 to be deleted")
	}
}

func TestRoomStore_CleanupInactive(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "rooms_test_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	store, err := NewRoomStore(tmpPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	now := time.Now()
	oldTime := now.Add(-2 * time.Hour)

	// Room 1: active (recent activity)
	store.SaveRoom(&RoomData{
		ID:             "room-1",
		Name:           "Active Room",
		CreatedAt:      oldTime,
		LastActivityAt: now,
	})

	// Room 2: inactive (old activity)
	store.SaveRoom(&RoomData{
		ID:             "room-2",
		Name:           "Inactive Room",
		CreatedAt:      oldTime,
		LastActivityAt: oldTime,
	})

	if store.Count() != 2 {
		t.Errorf("Expected 2 rooms, got %d", store.Count())
	}

	// Cleanup rooms inactive for more than 1 hour
	count, err := store.CleanupInactive(1 * time.Hour)
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 room cleaned up, got %d", count)
	}

	if store.Count() != 1 {
		t.Errorf("Expected 1 room remaining, got %d", store.Count())
	}

	if store.GetRoom("room-1") == nil {
		t.Error("Expected active room to remain")
	}
	if store.GetRoom("room-2") != nil {
		t.Error("Expected inactive room to be deleted")
	}
}

func TestRoomStore_UpdateActivity(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "rooms_test_*.json")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	store, err := NewRoomStore(tmpPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	oldTime := time.Now().Add(-1 * time.Hour)
	store.SaveRoom(&RoomData{
		ID:             "room-1",
		Name:           "Test Room",
		CreatedAt:      oldTime,
		LastActivityAt: oldTime,
	})

	// Update activity
	beforeUpdate := time.Now()
	time.Sleep(10 * time.Millisecond)
	err = store.UpdateActivity("room-1")
	if err != nil {
		t.Fatalf("UpdateActivity failed: %v", err)
	}

	room := store.GetRoom("room-1")
	if room == nil {
		t.Fatal("Expected to find room")
	}

	if room.LastActivityAt.Before(beforeUpdate) {
		t.Error("Expected LastActivityAt to be updated")
	}
}
