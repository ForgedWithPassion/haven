package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration options
type Config struct {
	// Server port
	Port string

	// Database configuration
	DB DatabaseConfig

	// User inactivity timeout before deletion (default: 90 days)
	UserInactivityTimeout time.Duration

	// Room inactivity timeout before deletion (default: 7 days)
	RoomInactivityTimeout time.Duration

	// Message retention - delete messages older than this (default: 365 days)
	MessageRetention time.Duration

	// Cleanup interval - how often to run cleanup job (default: 1 hour)
	CleanupInterval time.Duration
}

// DatabaseConfig holds PostgreSQL connection settings
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	SSLMode  string
	MaxConns int
	MinConns int
}

// Load reads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		Port: getEnv("PORT", "9088"),
		DB: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "haven"),
			Password: getEnv("DB_PASSWORD", "haven"),
			Database: getEnv("DB_NAME", "haven"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
			MaxConns: getIntEnv("DB_MAX_CONNS", 10),
			MinConns: getIntEnv("DB_MIN_CONNS", 2),
		},
		UserInactivityTimeout: getDurationEnv("USER_INACTIVITY_TIMEOUT", 90*24*time.Hour),
		RoomInactivityTimeout: getDurationEnv("ROOM_INACTIVITY_TIMEOUT", 7*24*time.Hour),
		MessageRetention:      getDurationEnv("MESSAGE_RETENTION", 365*24*time.Hour),
		CleanupInterval:       getDurationEnv("CLEANUP_INTERVAL", 1*time.Hour),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		// Try parsing as hours first (e.g., "24" = 24 hours)
		if hours, err := strconv.Atoi(value); err == nil {
			return time.Duration(hours) * time.Hour
		}
		// Try parsing as duration string (e.g., "24h", "7d")
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
