package postgres

import (
	"context"
	"testing"
	"time"
)

func TestUserStore_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	user, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if user.ID == "" {
		t.Error("Expected user ID to be set")
	}
	if user.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", user.Username)
	}
	if user.FingerprintHash != "fingerprint123" {
		t.Errorf("Expected fingerprint hash 'fingerprint123', got '%s'", user.FingerprintHash)
	}
	if user.RecoveryCodeHash != "recovery456" {
		t.Errorf("Expected recovery code hash 'recovery456', got '%s'", user.RecoveryCodeHash)
	}
	if user.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}
	if user.LastSeenAt.IsZero() {
		t.Error("Expected LastSeenAt to be set")
	}
}

func TestUserStore_CreateDuplicateUsername(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create first user
	_, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create first user: %v", err)
	}

	// Try to create second user with same username
	_, err = store.Create(ctx, "testuser", "fingerprint789", "recovery000")
	if err == nil {
		t.Error("Expected error when creating duplicate username")
	}
}

func TestUserStore_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	created, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by ID
	user, err := store.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to get user by ID: %v", err)
	}
	if user == nil {
		t.Fatal("Expected to find user")
	}
	if user.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", user.Username)
	}
}

func TestUserStore_GetByUsername(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	_, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by username
	user, err := store.GetByUsername(ctx, "testuser")
	if err != nil {
		t.Fatalf("Failed to get user by username: %v", err)
	}
	if user == nil {
		t.Fatal("Expected to find user")
	}
	if user.FingerprintHash != "fingerprint123" {
		t.Errorf("Expected fingerprint hash 'fingerprint123', got '%s'", user.FingerprintHash)
	}

	// Get non-existent user
	user, err = store.GetByUsername(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if user != nil {
		t.Error("Expected nil for non-existent user")
	}
}

func TestUserStore_GetByFingerprint(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	_, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by fingerprint
	user, err := store.GetByFingerprint(ctx, "fingerprint123")
	if err != nil {
		t.Fatalf("Failed to get user by fingerprint: %v", err)
	}
	if user == nil {
		t.Fatal("Expected to find user")
	}
	if user.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", user.Username)
	}

	// Get non-existent fingerprint
	user, err = store.GetByFingerprint(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if user != nil {
		t.Error("Expected nil for non-existent fingerprint")
	}
}

func TestUserStore_GetByRecoveryCode(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	_, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Get by recovery code
	user, err := store.GetByRecoveryCode(ctx, "recovery456")
	if err != nil {
		t.Fatalf("Failed to get user by recovery code: %v", err)
	}
	if user == nil {
		t.Fatal("Expected to find user")
	}
	if user.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", user.Username)
	}
}

func TestUserStore_UpdateLastSeen(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	created, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	originalLastSeen := created.LastSeenAt

	// Wait a bit to ensure time difference
	time.Sleep(10 * time.Millisecond)

	// Update last seen
	err = store.UpdateLastSeen(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to update last seen: %v", err)
	}

	// Get user and check last seen was updated
	user, err := store.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}
	if !user.LastSeenAt.After(originalLastSeen) {
		t.Error("Expected LastSeenAt to be updated")
	}
}

func TestUserStore_UpdateFingerprint(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Create a user
	created, err := store.Create(ctx, "testuser", "fingerprint123", "recovery456")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Update fingerprint
	err = store.UpdateFingerprint(ctx, created.ID, "newfingerprint")
	if err != nil {
		t.Fatalf("Failed to update fingerprint: %v", err)
	}

	// Get user and check fingerprint was updated
	user, err := store.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to get user: %v", err)
	}
	if user.FingerprintHash != "newfingerprint" {
		t.Errorf("Expected fingerprint hash 'newfingerprint', got '%s'", user.FingerprintHash)
	}
}

func TestUserStore_Count(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	store := NewUserStore(testDB.Pool)
	ctx := context.Background()

	// Initially zero
	count, err := store.Count(ctx)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 users, got %d", count)
	}

	// Create users
	_, err = store.Create(ctx, "user1", "fp1", "rc1")
	if err != nil {
		t.Fatalf("Failed to create user1: %v", err)
	}
	_, err = store.Create(ctx, "user2", "fp2", "rc2")
	if err != nil {
		t.Fatalf("Failed to create user2: %v", err)
	}

	// Check count
	count, err = store.Count(ctx)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2 users, got %d", count)
	}
}
