package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"haven/migrations"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // Register pgx driver for database/sql
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

// TestDB holds a test database connection and container
type TestDB struct {
	Pool      *pgxpool.Pool
	Container *tcpostgres.PostgresContainer
	ConnStr   string
}

// SetupTestDB creates a PostgreSQL container and returns a connection pool
func SetupTestDB(t *testing.T) *TestDB {
	t.Helper()
	ctx := context.Background()

	// Start PostgreSQL container with explicit wait strategy
	// PostgreSQL logs "database system is ready to accept connections" twice:
	// 1. During initialization (not yet accepting external connections)
	// 2. When actually ready to accept connections
	// We wait for the second occurrence to ensure the database is truly ready
	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("haven_test"),
		tcpostgres.WithUsername("haven"),
		tcpostgres.WithPassword("haven"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start postgres container: %v", err)
	}

	// Get connection string
	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = container.Terminate(ctx)
		t.Fatalf("Failed to get connection string: %v", err)
	}

	// Create connection pool
	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		_ = container.Terminate(ctx)
		t.Fatalf("Failed to parse connection string: %v", err)
	}
	poolConfig.MaxConns = 5
	poolConfig.MinConns = 1

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		_ = container.Terminate(ctx)
		t.Fatalf("Failed to create connection pool: %v", err)
	}

	// Wait for database to be ready
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		_ = container.Terminate(context.Background())
		t.Fatalf("Failed to ping database: %v", err)
	}

	testDB := &TestDB{
		Pool:      pool,
		Container: container,
		ConnStr:   connStr,
	}

	// Run migrations
	if err := testDB.RunMigrations(); err != nil {
		testDB.Close()
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return testDB
}

// RunMigrations applies all migrations to the test database
func (db *TestDB) RunMigrations() error {
	// Create source from embedded files
	sourceDriver, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	// Open a separate sql.DB connection for migrations (not from pool)
	// This avoids connection management issues with pgxpool
	sqlDB, err := sql.Open("pgx", db.ConnStr)
	if err != nil {
		return fmt.Errorf("failed to open migration db: %w", err)
	}

	// Create database driver
	dbDriver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		_ = sqlDB.Close()
		return fmt.Errorf("failed to create migration db driver: %w", err)
	}

	// Create migrator
	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", dbDriver)
	if err != nil {
		_ = sqlDB.Close()
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		_, _ = m.Close()
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Close migrator to release source and database drivers
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		return fmt.Errorf("failed to close migration source: %w", srcErr)
	}
	if dbErr != nil {
		return fmt.Errorf("failed to close migration db: %w", dbErr)
	}

	return nil
}

// Close terminates the test database container
func (db *TestDB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
	if db.Container != nil {
		_ = db.Container.Terminate(context.Background())
	}
}

// TruncateAll removes all data from all tables (for test isolation)
func (db *TestDB) TruncateAll(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, `
		TRUNCATE room_messages, room_members, rooms, users CASCADE
	`)
	return err
}
