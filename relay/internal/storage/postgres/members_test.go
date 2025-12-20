//go:build integration

package postgres

import (
	"context"
	"testing"
)

func TestMemberStore_Add(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Add member
	member, err := memberStore.Add(ctx, room.ID, user.ID, user.Username)
	if err != nil {
		t.Fatalf("Failed to add member: %v", err)
	}

	if member.RoomID != room.ID {
		t.Errorf("Expected room ID '%s', got '%s'", room.ID, member.RoomID)
	}
	if member.UserID != user.ID {
		t.Errorf("Expected user ID '%s', got '%s'", user.ID, member.UserID)
	}
	if member.Username != user.Username {
		t.Errorf("Expected username '%s', got '%s'", user.Username, member.Username)
	}
	if member.JoinedAt.IsZero() {
		t.Error("Expected JoinedAt to be set")
	}
}

func TestMemberStore_AddDuplicate(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Add member first time
	_, err := memberStore.Add(ctx, room.ID, user.ID, user.Username)
	if err != nil {
		t.Fatalf("Failed to add member first time: %v", err)
	}

	// Add same member again - should return existing (upsert behavior)
	member, err := memberStore.Add(ctx, room.ID, user.ID, user.Username)
	if err != nil {
		t.Fatalf("Failed on duplicate add: %v", err)
	}
	if member == nil {
		t.Error("Expected member to be returned on duplicate")
	}
}

func TestMemberStore_Remove(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Add member
	_, _ = memberStore.Add(ctx, room.ID, user.ID, user.Username)

	// Verify member exists
	isMember, _ := memberStore.IsMember(ctx, room.ID, user.ID)
	if !isMember {
		t.Fatal("Expected user to be a member")
	}

	// Remove member
	err := memberStore.Remove(ctx, room.ID, user.ID)
	if err != nil {
		t.Fatalf("Failed to remove member: %v", err)
	}

	// Verify member is gone
	isMember, _ = memberStore.IsMember(ctx, room.ID, user.ID)
	if isMember {
		t.Error("Expected user to no longer be a member")
	}
}

func TestMemberStore_IsMember(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create users and room
	user1, _ := userStore.Create(ctx, "user1", "fp1", "rc1")
	user2, _ := userStore.Create(ctx, "user2", "fp2", "rc2")
	room, _ := roomStore.Create(ctx, "Test Room", user1.ID, user1.Username, true)

	// Add user1 as member
	_, _ = memberStore.Add(ctx, room.ID, user1.ID, user1.Username)

	// user1 should be a member
	isMember, err := memberStore.IsMember(ctx, room.ID, user1.ID)
	if err != nil {
		t.Fatalf("Failed to check membership: %v", err)
	}
	if !isMember {
		t.Error("Expected user1 to be a member")
	}

	// user2 should not be a member
	isMember, err = memberStore.IsMember(ctx, room.ID, user2.ID)
	if err != nil {
		t.Fatalf("Failed to check membership: %v", err)
	}
	if isMember {
		t.Error("Expected user2 to not be a member")
	}
}

func TestMemberStore_GetRoomMembers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create users and room
	user1, _ := userStore.Create(ctx, "user1", "fp1", "rc1")
	user2, _ := userStore.Create(ctx, "user2", "fp2", "rc2")
	room, _ := roomStore.Create(ctx, "Test Room", user1.ID, user1.Username, true)

	// Add members
	_, _ = memberStore.Add(ctx, room.ID, user1.ID, user1.Username)
	_, _ = memberStore.Add(ctx, room.ID, user2.ID, user2.Username)

	// Get room members
	members, err := memberStore.GetRoomMembers(ctx, room.ID)
	if err != nil {
		t.Fatalf("Failed to get room members: %v", err)
	}
	if len(members) != 2 {
		t.Errorf("Expected 2 members, got %d", len(members))
	}
}

func TestMemberStore_GetUserRooms(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create user and rooms
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room1, _ := roomStore.Create(ctx, "Room 1", user.ID, user.Username, true)
	room2, _ := roomStore.Create(ctx, "Room 2", user.ID, user.Username, true)

	// Add user to both rooms
	_, _ = memberStore.Add(ctx, room1.ID, user.ID, user.Username)
	_, _ = memberStore.Add(ctx, room2.ID, user.ID, user.Username)

	// Get user's rooms
	roomIDs, err := memberStore.GetUserRooms(ctx, user.ID)
	if err != nil {
		t.Fatalf("Failed to get user rooms: %v", err)
	}
	if len(roomIDs) != 2 {
		t.Errorf("Expected 2 rooms, got %d", len(roomIDs))
	}
}

func TestMemberStore_CascadeDeleteOnRoomDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	userStore := NewUserStore(testDB.Pool)
	roomStore := NewRoomStore(testDB.Pool)
	memberStore := NewMemberStore(testDB.Pool)
	ctx := context.Background()

	// Create user and room
	user, _ := userStore.Create(ctx, "testuser", "fp", "rc")
	room, _ := roomStore.Create(ctx, "Test Room", user.ID, user.Username, true)

	// Add member
	_, _ = memberStore.Add(ctx, room.ID, user.ID, user.Username)

	// Verify member exists
	members, _ := memberStore.GetRoomMembers(ctx, room.ID)
	if len(members) != 1 {
		t.Fatal("Expected 1 member before delete")
	}

	// Delete room - should cascade delete members
	err := roomStore.Delete(ctx, room.ID)
	if err != nil {
		t.Fatalf("Failed to delete room: %v", err)
	}

	// Verify members are gone (room is gone, so GetRoomMembers returns empty)
	members, _ = memberStore.GetRoomMembers(ctx, room.ID)
	if len(members) != 0 {
		t.Errorf("Expected 0 members after room delete, got %d", len(members))
	}
}
