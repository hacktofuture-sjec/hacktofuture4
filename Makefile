.PHONY: help setup install backend agent jira hubspot frontend frontend-install frontend-build frontend-typecheck frontend-lint docker-up docker-down deps-up deps-down dev-check-ports lint lint-py lint-frontend format fl type-check test test-backend test-agent test-frontend test-cov dev clean migrate makemigrations shell superuser celery-worker celery-beat

# ── Tooling paths ─────────────────────────────────────────────────────────────
UV            := $(shell command -v uv 2> /dev/null || echo $(CURDIR)/.venv/bin/uv)
PYTHON        := $(UV) run python
BACKEND_PY    := $(UV) run python
BACKEND_PYTEST := $(UV) run pytest
AGENT_PYTEST  := $(UV) run pytest
BLACK         := $(UV) run black
FLAKE8        := $(UV) run flake8
ISORT         := $(UV) run isort

# ── Paths ──────────────────────────────────────────────────────────────────
FORMAT_PATHS  := backend agent-service mcp-servers/hubspot mcp-servers/jira mcp-servers/linear mcp-servers/slack
LINT_PATHS    := backend agent-service mcp-servers/hubspot mcp-servers/jira mcp-servers/linear mcp-servers/slack

# Default target
help:
	@echo "Voice-to-Action Hackathon Project"
	@echo "=================================="
	@echo "make setup          - Initialize all services (backend, agent, mcp, frontend deps)"
	@echo "make install        - Install uv and dependencies from requirements.txt"
	@echo "make dev            - Start deps + run ALL tests + launch every service (parallel)"
	@echo ""
	@echo "-- Individual services --"
	@echo "make backend        - Start Django backend"
	@echo "make agent          - Start Agent service"
	@echo "make jira           - Start Jira MCP server"
	@echo "make hubspot        - Start HubSpot MCP server"
	@echo "make frontend       - Start Frontend dev server (Vite on :5173)"
	@echo "make celery-worker  - Start Celery worker"
	@echo "make celery-beat    - Start Celery beat scheduler"
	@echo ""
	@echo "-- Frontend tooling --"
	@echo "make frontend-install   - Install frontend npm dependencies"
	@echo "make frontend-build     - Production build of the frontend (dist/)"
	@echo "make frontend-typecheck - Run tsc --noEmit on the frontend"
	@echo "make frontend-lint      - Run ESLint over frontend/src"
	@echo ""
	@echo "-- Docker --"
	@echo "make docker-up      - Start all Docker services"
	@echo "make docker-down    - Stop all Docker services"
	@echo "make deps-up        - Start ONLY Postgres + Redis (used by 'make dev')"
	@echo "make deps-down      - Stop Postgres + Redis"
	@echo ""
	@echo "-- Quality --"
	@echo "make fl             - Format + lint Python AND frontend (runs everything)"
	@echo "make lint           - Python lint only (Black + isort + Flake8)"
	@echo "make lint-py        - Alias for 'make lint'"
	@echo "make lint-frontend  - Frontend ESLint + tsc --noEmit"
	@echo "make format         - Format all Python code with isort + Black"
	@echo "make type-check     - mypy (strict) on agent-service"
	@echo ""
	@echo "-- Testing --"
	@echo "make test           - Run ALL test suites (backend + agent + frontend)"
	@echo "make test-backend   - Backend pytest only"
	@echo "make test-agent     - Agent-service pytest only"
	@echo "make test-frontend  - Frontend tsc --noEmit (TS type safety check)"
	@echo "make test-cov       - Backend pytest with coverage report"
	@echo ""
	@echo "make clean          - Clean build artifacts"

# Setup all services
setup:
	@echo "Setting up backend..."
	cd backend && $(UV) sync
	@echo "Setting up agent service..."
	cd agent-service && $(UV) sync
	@echo "Setting up Jira MCP server..."
	cd mcp-servers/jira && $(UV) sync
	@echo "Setting up HubSpot MCP server..."
	cd mcp-servers/hubspot && $(UV) sync
	@echo "Setting up frontend..."
	cd frontend && npm install
	@echo "Setup complete!"

# Install uv and dependencies
install:
	pip install uv
	@echo "Checking for uv..."
	@if ! command -v uv > /dev/null && [ ! -f "$(UV)" ]; then \
		echo "uv not found. Install via: curl -LsSf https://astral.sh/uv/install.sh | sh"; \
		exit 1; \
	fi
	@echo "Installing dependencies via uv sync..."
	uv sync --all-extras
	@echo "Installation complete! Activate with: source .venv/bin/activate"

# Backend commands
backend:
	cd backend && $(BACKEND_PY) manage.py runserver 8000

migrate:
	@echo "Running migrations..."
	cd backend && $(BACKEND_PY) manage.py migrate --no-input

makemigrations:
	@echo "Creating migrations..."
	cd backend && $(BACKEND_PY) manage.py makemigrations

shell:
	cd backend && $(BACKEND_PY) manage.py shell

superuser:
	@echo "Creating Django superuser..."
	cd backend && $(BACKEND_PY) manage.py createsuperuser

celery-worker:
	@echo "Starting Celery worker (queues: ingestion, processing, analytics)..."
	cd backend && $(PYTHON) -m celery -A backend worker \
		-Q ingestion,processing,analytics \
		--concurrency=4 \
		--loglevel=info

celery-beat:
	@echo "Starting Celery beat scheduler..."
	cd backend && $(PYTHON) -m celery -A backend beat \
		--scheduler django_celery_beat.schedulers:DatabaseScheduler \
		--loglevel=info

# Agent service
agent:
	cd agent-service && $(PYTHON) -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8001

# MCP servers
jira:
	cd mcp-servers/jira && uv run uvicorn src.server:app --reload --host 0.0.0.0 --port 8002

hubspot:
	cd mcp-servers/hubspot && uv run uvicorn src.server:app --reload --host 0.0.0.0 --port 8003

# Frontend
frontend:
	cd frontend && npm run dev

frontend-install:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

frontend-build:
	@echo "Building frontend production bundle..."
	cd frontend && npm run build

# Typecheck avoids `tsc -b` which chokes when the project is on a UNC path
# on Windows; this targets the app tsconfig directly and works everywhere.
frontend-typecheck:
	@echo "Typechecking frontend..."
	@test -f frontend/node_modules/typescript/bin/tsc || (echo "ERROR: frontend/node_modules missing. Run: make frontend-install   (CI must run npm ci in frontend/ before make fl or make test)"; exit 1)
	cd frontend && node ./node_modules/typescript/bin/tsc --noEmit -p ./tsconfig.app.json

frontend-lint:
	@echo "Linting frontend (ESLint)..."
	@test -f frontend/node_modules/eslint/bin/eslint.js || (echo "ERROR: frontend/node_modules missing. Run: make frontend-install   (CI must run npm ci in frontend/ before make fl or make test)"; exit 1)
	cd frontend && node ./node_modules/eslint/bin/eslint.js src

# Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Only the stateful dependencies (Postgres + Redis) — used by `make dev` so
# we can hot-reload backend/agent/celery/frontend locally without conflicting
# with the containerized copies of those services.
deps-up:
	@echo "Starting Postgres + Redis via Docker..."
	docker compose up -d postgres redis
	@echo "Waiting for dependencies to become healthy..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-postgres} >/dev/null 2>&1; then \
			echo "Postgres ready."; break; \
		fi; \
		sleep 1; \
	done

deps-down:
	@echo "Stopping Postgres + Redis..."
	docker compose stop postgres redis

# Fail fast if dev ports are taken (avoids half-started stack + confusing logs).
dev-check-ports:
	@echo "Checking dev ports 8000 / 8001 / 5173..."
	@$(PYTHON) scripts/check_dev_ports.py

# ── make dev ────────────────────────────────────────────────────────────────
# Full stack dev loop:
#   1. Start Postgres + Redis (Docker)
#   2. Apply Django migrations
#   3. Run the complete test suite (backend + agent + frontend) — fails fast
#      if any app is broken so we never start a busted app.
#   4. Launch Django, FastAPI agent, Celery worker, Celery beat, and the Vite
#      frontend concurrently with labelled, interleaved logs. Ctrl+C tears
#      them all down via `trap 'kill 0'`.
#
# Requires: docker, uv-managed venv (.venv), frontend/node_modules.
dev: deps-up dev-check-ports
	@echo ""
	@echo "==> Applying database migrations..."
	$(MAKE) migrate
	@echo ""
	@echo "==> Purging Celery broker queues (clears stale tasks that reference old DB rows)..."
	@cd backend && $(PYTHON) -m celery -A backend purge -f 2>/dev/null || true
	@echo ""
	@echo "==> Verifying every app via full test suite..."
	$(MAKE) test
	@if [ ! -d frontend/node_modules ]; then \
		echo ""; \
		echo "==> Installing frontend dependencies (first run)..."; \
		$(MAKE) frontend-install; \
	fi
	@echo ""
	@echo "✅ All checks passed. Launching the full stack..."
	@echo "   Django backend    → http://localhost:8000"
	@echo "   FastAPI agent     → http://localhost:8001"
	@echo "   Frontend (Vite)   → http://localhost:5173"
	@echo "   Celery worker     → queues: ingestion, processing, analytics"
	@echo "   Celery beat       → scheduled tasks"
	@echo ""
	@echo "   Press Ctrl+C to stop everything."
	@echo ""
	@trap 'echo; echo "Stopping all services..."; kill 0' INT TERM; \
		( cd backend        && $(BACKEND_PY) manage.py runserver 8000 2>&1                                                                            | sed -u 's/^/[backend]        /' ) & \
		( cd agent-service  && $(PYTHON) -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload 2>&1                                             | sed -u 's/^/[agent]          /' ) & \
		( cd backend        && $(PYTHON) -m celery -A backend worker -Q ingestion,processing,analytics --concurrency=4 --loglevel=info 2>&1          | sed -u 's/^/[celery-worker]  /' ) & \
		( cd backend        && $(PYTHON) -m celery -A backend beat --scheduler django_celery_beat.schedulers:DatabaseScheduler --loglevel=info 2>&1  | sed -u 's/^/[celery-beat]    /' ) & \
		( cd frontend       && npm run dev 2>&1                                                                                                      | sed -u 's/^/[frontend]       /' ) & \
		wait

# Linting & Formatting
# `make fl` is the umbrella quality gate: formats Python, lints Python, and
# runs the frontend ESLint + typecheck. Individual targets (format, lint,
# lint-py, lint-frontend, frontend-lint, frontend-typecheck) remain usable
# on their own.
fl: format lint lint-frontend
	@echo "All formatting + linting checks passed!"

# Python linting (kept as-is; `lint-py` is an alias for clarity)
lint lint-py:
	@echo "Running Black linter..."
	@for path in $(LINT_PATHS); do \
		echo "Checking $$path..."; \
		cd $$path && $(BLACK) --check . || exit 1; \
		cd $(CURDIR); \
	done
	@echo "Running isort linter..."
	@for path in $(LINT_PATHS); do \
		echo "Checking $$path..."; \
		cd $$path && $(ISORT) --check --profile black . || exit 1; \
		cd $(CURDIR); \
	done
	@echo "Running Flake8 linter..."
	@for path in $(LINT_PATHS); do \
		echo "Linting $$path..."; \
		cd $$path && $(FLAKE8) . || exit 1; \
		cd $(CURDIR); \
	done
	@echo "Python linting complete!"

# Frontend quality bucket — runs ESLint and the TS typecheck together.
lint-frontend: frontend-lint frontend-typecheck
	@echo "Frontend lint + typecheck complete!"

type-check:
	@echo "Running mypy (strict) on agent-service..."
	cd agent-service && $(PYTHON) -m mypy src/ --config-file mypy.ini
	@echo "Type check complete!"

format:
	@echo "Formatting Python code with isort..."
	@for path in $(FORMAT_PATHS); do \
		echo "Formatting $$path..."; \
		cd $$path && $(ISORT) --profile black . || exit 1; \
		cd $(CURDIR); \
	done
	@echo "Formatting Python code with Black..."
	@for path in $(FORMAT_PATHS); do \
		echo "Formatting $$path..."; \
		cd $$path && $(BLACK) . || exit 1; \
		cd $(CURDIR); \
	done
	@echo "Formatting complete!"

# Testing
# `make test` is the umbrella — runs every app's test suite across the whole
# monorepo (backend pytest, agent-service pytest, frontend TS typecheck) plus a
# backend coverage pass. Individual suites remain runnable via test-backend /
# test-agent / test-frontend / test-cov.
test: test-backend test-agent test-frontend
	@echo "Running backend tests with coverage..."
	cd backend && $(BACKEND_PYTEST) --tb=short --cov=. --cov-report=term-missing -q
	@echo "All tests complete across backend, agent, and frontend!"

test-backend:
	@echo "Running backend tests (pytest)..."
	cd backend && $(BACKEND_PYTEST) --tb=short -v

test-agent:
	@echo "Running agent service tests (pytest)..."
	cd agent-service && $(AGENT_PYTEST) --tb=short -v

# Frontend tests = TypeScript type-safety check. This surfaces every
# prop/signature/response-shape mismatch and is the TS equivalent of pytest.
test-frontend: frontend-typecheck
	@echo "Frontend type-safety check complete!"

test-cov:
	@echo "Running backend tests with coverage..."
	cd backend && $(BACKEND_PYTEST) --tb=short --cov=. --cov-report=term-missing -q

# Clean
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache
	rm -rf backend/.pytest_cache agent-service/.pytest_cache
	rm -rf mcp-servers/jira/.pytest_cache mcp-servers/hubspot/.pytest_cache
	@echo "Clean complete!"
