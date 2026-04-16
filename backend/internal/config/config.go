package config

import (
	"os"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	// Server
	Port    string
	GinMode string

	// Python engine service
	EngineURL string

	// Flat-file vault path (shared with Python engine via volume mount)
	VaultPath string

	// CORS
	CORSOrigins []string
}

// Load reads environment variables and returns a populated Config.
// No longer requires DATABASE_URL or ChromaDB.
func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8000"),
		GinMode:     getEnv("GIN_MODE", "debug"),
		EngineURL:   getEnv("ENGINE_URL", "http://localhost:8002"),
		VaultPath:   getEnv("VAULT_PATH", "vault"),
		CORSOrigins: getEnvSlice("CORS_ORIGINS", []string{"http://localhost:3000"}),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}



func getEnvSlice(key string, fallback []string) []string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
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
