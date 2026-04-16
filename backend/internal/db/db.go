package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the shared connection pool used throughout the application.
var Pool *pgxpool.Pool

// Connect initialises the pgx connection pool and verifies connectivity.
func Connect(ctx context.Context, dsn string) error {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("parse dsn: %w", err)
	}

	cfg.MinConns = 2
	cfg.MaxConns = 20

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}

	Pool = pool
	return nil
}

// Close gracefully shuts down the connection pool.
func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
