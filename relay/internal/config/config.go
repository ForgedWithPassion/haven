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

	// Room storage file path
	RoomStoragePath string

	// User storage file path
	UserStoragePath string

	// Room inactivity timeout before deletion (default: 7 days)
	RoomInactivityTimeout time.Duration

	// Cleanup interval - how often to check for inactive rooms (default: 1 hour)
	CleanupInterval time.Duration
}

// Load reads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		Port:                  getEnv("PORT", "9088"),
		RoomStoragePath:       getEnv("ROOM_STORAGE_PATH", "rooms.json"),
		UserStoragePath:       getEnv("USER_STORAGE_PATH", "users.json"),
		RoomInactivityTimeout: getDurationEnv("ROOM_INACTIVITY_TIMEOUT", 7*24*time.Hour),
		CleanupInterval:       getDurationEnv("CLEANUP_INTERVAL", 1*time.Hour),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
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
