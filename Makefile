.PHONY: setup dev build test lint clean docker-up docker-down \
        db-migrate seed simulate health-check

# ─────────────────────────────────────────────────────────────────────────────
# REKALL — Root Makefile
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

## setup: first-time bootstrap of the entire dev environment
setup:
	@./scripts/setup.sh

## dev: start all services in development mode (Go + Python + Next.js)
dev:
	@./scripts/dev.sh

## seed: seed 5 human vault entries for demo scenarios
seed:
	@VAULT_PATH=vault python3 scripts/seed-vault.py

## vault-reset: delete all vault entries and re-seed
vault-reset:
	@rm -rf vault/local/ vault/org/ vault/episodes.json
	@VAULT_PATH=vault python3 scripts/seed-vault.py

## simulate: inject a simulated failure (default: postgres_refused)
## Usage: make simulate SCENARIO=oom_kill
simulate:
	@./scripts/simulate.sh $(or $(SCENARIO),postgres_refused)

## health: check all service health endpoints
health:
	@./scripts/health-check.sh

## test: run the full test suite (Go + Python + frontend unit)
test:
	@./scripts/test-all.sh

## test-go: run only the Go backend tests
test-go:
	@cd backend && go test -race ./...

## test-py: run only the Python engine tests
test-py:
	@cd engine && python3 -m pytest tests/ -v

## test-fe: run only the frontend unit tests
test-fe:
	@cd frontend && npm test -- --passWithNoTests --ci

## test-e2e: run Playwright end-to-end tests
test-e2e:
	@cd frontend && npx playwright test

## lint-go: run Go linter
lint-go:
	@cd backend && go vet ./... && echo "go vet passed"

## build-go: compile the Go binary
build-go:
	@cd backend && make build

## docker-up: build and start all containers
docker-up:
	@docker compose up --build -d

## docker-down: stop and remove all containers
docker-down:
	@docker compose down

## docker-logs: tail logs from all containers
docker-logs:
	@docker compose logs -f

## clean: remove build artefacts
clean:
	@cd backend && rm -rf bin/ coverage.out coverage.html
	@cd frontend && rm -rf .next out node_modules/.cache playwright-report

help:
	@echo "REKALL available targets:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  make /' | column -t -s ':'
