.PHONY: help setup install backend agent jira hubspot frontend docker-up docker-down lint format fl test clean

# ── Tooling paths ─────────────────────────────────────────────────────────────
UV            := $(shell pwd)/.venv/bin/uv
PYTHON        := $(shell pwd)/.venv/bin/python
BACKEND_PY    := $(shell pwd)/.venv/bin/python
BACKEND_PYTEST := $(shell pwd)/.venv/bin/pytest
AGENT_PYTEST  := $(shell pwd)/.venv/bin/pytest
BLACK         := $(shell pwd)/.venv/bin/black
FLAKE8        := $(shell pwd)/.venv/bin/flake8

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
	@echo "Checking for uv..."
	@if ! command -v uv > /dev/null; then \
		echo "uv not found, attempting to install via pip..."; \
		python3 -m pip install uv || echo "Global pip install restricted. Please install uv manually (e.g., curl -LsSf https://astral.sh/uv/install.sh | sh)"; \
	else \
		echo "uv is already installed."; \
	fi
	@echo "Installing dependencies from requirements.txt..."
	uv pip install -r requirements.txt
	@echo "Installation complete!"

# Backend commands
backend:
	cd backend && $(BACKEND_PY) manage.py runserver 8000

backend-migrate:
	cd backend && $(BACKEND_PY) manage.py migrate

backend-makemigrations:
	cd backend && $(BACKEND_PY) manage.py makemigrations

backend-shell:
	cd backend && $(BACKEND_PY) manage.py shell

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
	cd backend && $(BLACK) --check .
	cd agent-service && $(BLACK) --check .
	@echo "Running Flake8 linter..."
	cd backend && $(FLAKE8) .
	cd agent-service && $(FLAKE8) .
	@echo "Linting complete!"

format:
	@echo "Formatting Python code with Black..."
	cd backend && $(BLACK) .
	cd agent-service && $(BLACK) .
	@echo "Formatting complete!"

# Testing
test:
	@echo "Running backend tests (pytest)..."
	cd backend && $(BACKEND_PYTEST) --tb=short -q
	@echo "Running agent service tests (pytest)..."
	cd agent-service && $(AGENT_PYTEST) --tb=short -q
	@echo "Tests complete!"

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
