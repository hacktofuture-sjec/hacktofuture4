.PHONY: help setup install backend agent jira hubspot frontend docker-up docker-down lint format fl type-check test clean migrate makemigrations shell superuser celery-worker celery-beat test-backend test-agent test-cov

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
	@echo "make setup          - Initialize all services"
	@echo "make install        - Install uv and dependencies from requirements.txt"
	@echo "make backend        - Start Django backend"
	@echo "make agent          - Start Agent service"
	@echo "make jira           - Start Jira MCP server"
	@echo "make hubspot        - Start HubSpot MCP server"
	@echo "make frontend       - Start Frontend dev server"
	@echo "make docker-up      - Start Docker services (Postgres, Redis)"
	@echo "make docker-down    - Stop Docker services"
	@echo "make lint           - Run Black linter on all Python code"
	@echo "make format         - Format all Python code with Black"
	@echo "make test           - Run tests across services"
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

# Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# Linting & Formatting
fl: format lint

lint:
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
	@echo "Linting complete!"

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
test:
	@echo "Running backend tests (pytest)..."
	cd backend && $(BACKEND_PYTEST) --tb=short -q
	@echo "Running agent service tests (pytest)..."
	cd agent-service && $(AGENT_PYTEST) --tb=short -q
	@echo "Tests complete!"
	@echo "Running tests with coverage..."
	cd backend && $(BACKEND_PYTEST) --tb=short --cov=. --cov-report=term-missing -q

test-backend:
	@echo "Running backend tests only..."
	cd backend && $(BACKEND_PYTEST) --tb=short -v

test-agent:
	@echo "Running agent service tests only..."
	cd agent-service && $(AGENT_PYTEST) --tb=short -v

test-cov:
	@echo "Running tests with coverage..."
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
