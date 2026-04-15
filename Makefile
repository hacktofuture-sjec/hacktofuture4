.PHONY: help setup backend agent jira hubspot frontend docker-up docker-down lint format test clean

# Default target
help:
	@echo "Voice-to-Action Hackathon Project"
	@echo "=================================="
	@echo "make setup          - Initialize all services"
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
	cd backend && uv sync
	@echo "Setting up agent service..."
	cd agent-service && uv sync
	@echo "Setting up Jira MCP server..."
	cd mcp-servers/jira && uv sync
	@echo "Setting up HubSpot MCP server..."
	cd mcp-servers/hubspot && uv sync
	@echo "Setting up frontend..."
	cd frontend && npm install
	@echo "Setup complete!"

# Backend commands
backend:
	cd backend && uv run python manage.py runserver 8000

backend-migrate:
	cd backend && uv run python manage.py migrate

backend-makemigrations:
	cd backend && uv run python manage.py makemigrations

backend-shell:
	cd backend && uv run python manage.py shell

# Agent service
agent:
	cd agent-service && uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8001

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
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Linting & Formatting
lint:
	@echo "Running Black linter..."
	cd backend && uv run black --check .
	cd agent-service && uv run black --check .
	cd mcp-servers/jira && uv run black --check .
	cd mcp-servers/hubspot && uv run black --check .
	@echo "Linting complete!"

format:
	@echo "Formatting Python code with Black..."
	cd backend && uv run black .
	cd agent-service && uv run black .
	cd mcp-servers/jira && uv run black .
	cd mcp-servers/hubspot && uv run black .
	@echo "Formatting complete!"

# Testing
test:
	@echo "Running tests..."
	cd backend && uv run python manage.py test
	cd agent-service && uv run pytest
	@echo "Tests complete!"

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
