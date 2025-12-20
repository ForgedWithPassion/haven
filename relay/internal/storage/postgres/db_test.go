//go:build integration

package postgres

import (
	"context"
	"testing"
)

func TestSetupTestDB(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	// Verify we can query the database
	ctx := context.Background()
	var result int
	err := testDB.Pool.QueryRow(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		t.Fatalf("Failed to query database: %v", err)
	}
	if result != 1 {
		t.Errorf("Expected 1, got %d", result)
	}
}

func TestMigrationsCreateTables(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	ctx := context.Background()

	// Verify users table exists
	var tableName string
	err := testDB.Pool.QueryRow(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'users'
	`).Scan(&tableName)
	if err != nil {
		t.Fatalf("Failed to find users table: %v", err)
	}
	if tableName != "users" {
		t.Errorf("Expected 'users' table, got %s", tableName)
	}

	// Verify rooms table exists
	err = testDB.Pool.QueryRow(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'rooms'
	`).Scan(&tableName)
	if err != nil {
		t.Fatalf("Failed to find rooms table: %v", err)
	}

	// Verify room_members table exists
	err = testDB.Pool.QueryRow(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'room_members'
	`).Scan(&tableName)
	if err != nil {
		t.Fatalf("Failed to find room_members table: %v", err)
	}

	// Verify room_messages table exists
	err = testDB.Pool.QueryRow(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'room_messages'
	`).Scan(&tableName)
	if err != nil {
		t.Fatalf("Failed to find room_messages table: %v", err)
	}
}

func TestTruncateAll(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := SetupTestDB(t)
	defer testDB.Close()

	ctx := context.Background()

	// Insert a test user
	_, err := testDB.Pool.Exec(ctx, `
		INSERT INTO users (username, fingerprint_hash)
		VALUES ('testuser', 'abc123')
	`)
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}

	// Verify user exists
	var count int
	err = testDB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 user, got %d", count)
	}

	// Truncate all tables
	err = testDB.TruncateAll(ctx)
	if err != nil {
		t.Fatalf("Failed to truncate tables: %v", err)
	}

	// Verify user was removed
	err = testDB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count users after truncate: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 users after truncate, got %d", count)
	}
}
