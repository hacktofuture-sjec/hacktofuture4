package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	// Server
	Port    string
	GinMode string

	// PostgreSQL
	DatabaseURL string

	// Python engine service
	EngineURL string

	// CORS
	CORSOrigins []string

	// ChromaDB (forwarded to engine)
	ChromaDBHost string
	ChromaDBPort int
}

// Load reads environment variables and returns a populated Config.
// Missing required variables cause a fatal error at startup.
func Load() *Config {
	port := getEnv("PORT", "8000")
	dbURL := mustGetEnv("DATABASE_URL")
	engineURL := getEnv("ENGINE_URL", "http://localhost:8002")
	corsOrigins := getEnvSlice("CORS_ORIGINS", []string{"http://localhost:3000"})
	chromaPort, _ := strconv.Atoi(getEnv("CHROMADB_PORT", "8001"))

	return &Config{
		Port:         port,
		GinMode:      getEnv("GIN_MODE", "debug"),
		DatabaseURL:  dbURL,
		EngineURL:    engineURL,
		CORSOrigins:  corsOrigins,
		ChromaDBHost: getEnv("CHROMADB_HOST", "localhost"),
		ChromaDBPort: chromaPort,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}

func getEnvSlice(key string, fallback []string) []string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	// comma-separated
	result := make([]string, 0)
	start := 0
	for i := 0; i <= len(v); i++ {
		if i == len(v) || v[i] == ',' {
			part := v[start:i]
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}
