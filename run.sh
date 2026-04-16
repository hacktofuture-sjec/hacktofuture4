#!/usr/bin/env bash
# ────────────────��───────────────────────���─────────────────────────────
#  HTF 4.0 — Red vs Blue Autonomous Security Simulation
#  Automated launcher for all project components
# ───────────────────────────────────���──────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# PIDs to track for cleanup
PIDS=()

CLEANED_UP=0
cleanup() {
    [ "$CLEANED_UP" = "1" ] && return
    CLEANED_UP=1
    echo ""
    echo -e "${YELLOW}Shutting down all services...${NC}"
    for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    sleep 1
    for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
    echo -e "${GREEN}All services stopped.${NC}"
}

trap cleanup SIGINT SIGTERM EXIT

banner() {
    echo ""
    echo -e "${CYAN}${BOLD}═════════���══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  HTF 4.0 — Red vs Blue Autonomous Security Simulation${NC}"
    echo -e "${CYAN}${BOLD}════════════���═══════════════════════════════════════════════${NC}"
    echo ""
}

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_blue()  { echo -e "${BLUE}[BLUE]${NC}  $1"; }
log_red()   { echo -e "${RED}[RED]${NC}   $1"; }

# ── Detect tools ──���──────────────────────────────────────────────────

detect_python() {
    if command -v python3 &>/dev/null; then
        PYTHON=python3
    elif command -v python &>/dev/null; then
        PYTHON=python
    else
        log_error "Python 3 not found. Please install Python 3.9+."
        exit 1
    fi
    PY_VERSION=$($PYTHON --version 2>&1)
    log_info "Python: $PY_VERSION ($PYTHON)"
}

detect_node() {
    if command -v node &>/dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js: $NODE_VERSION"
        return 0
    else
        log_warn "Node.js not found. Frontends will not be started."
        return 1
    fi
}

detect_npm() {
    if command -v npm &>/dev/null; then
        return 0
    else
        log_warn "npm not found. Frontends will not be started."
        return 1
    fi
}

# ── Port management ─���───────────────────────────────────────────────

free_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_warn "Port $port in use — killing existing processes"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

free_all_ports() {
    log_info "Freeing required ports..."
    local ports=("$@")
    for port in "${ports[@]}"; do
        free_port "$port"
    done
}

# ── Setup ────────────────────────────────────────────────────────────

setup_env() {
    if [ ! -f "$ROOT_DIR/.env" ]; then
        log_warn ".env file not found — creating from .env.example"
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
        log_info "Created .env (edit it to add API keys if needed)"
    else
        log_info ".env file found"
    fi
}

install_python_deps() {
    log_info "Installing Python dependencies..."
    $PYTHON -m pip install -r "$ROOT_DIR/requirements.txt" --quiet 2>&1 | tail -1 || {
        log_warn "pip install had warnings (continuing anyway)"
    }
    log_info "Python dependencies ready"
}

install_frontend_deps() {
    local dir="$1"
    local name="$2"
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
        if [ ! -d "$dir/node_modules" ]; then
            log_info "Installing $name frontend dependencies..."
            (cd "$dir" && npm install --silent 2>&1) || {
                log_warn "npm install for $name had issues"
            }
        else
            log_info "$name frontend dependencies already installed"
        fi
    fi
}

# ── Start services ─────────��─────────────────────────────────────────

start_blue_backend() {
    log_blue "Starting Blue Agent backend on port 8002..."
    PYTHONPATH="$ROOT_DIR" $PYTHON -m uvicorn blue_agent.backend.main:app \
        --host 0.0.0.0 --port 8002 --log-level info \
        --reload --reload-dir "$ROOT_DIR/blue_agent" --reload-dir "$ROOT_DIR/core" \
        &
    local pid=$!
    PIDS+=("$pid")
    log_blue "Blue backend PID: $pid"
}

start_red_backend() {
    log_red "Starting Red Agent backend on port 8001..."
    PYTHONPATH="$ROOT_DIR" $PYTHON -m uvicorn red_agent.backend.main:app \
        --host 0.0.0.0 --port 8001 --log-level info \
        --reload --reload-dir "$ROOT_DIR/red_agent" --reload-dir "$ROOT_DIR/core" \
        &
    local pid=$!
    PIDS+=("$pid")
    log_red "Red backend PID: $pid"
}

start_blue_frontend() {
    local dir="$ROOT_DIR/blue_agent/frontend"
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
        log_blue "Starting Blue frontend on port 5174..."
        (cd "$dir" && npm run dev -- --port 5174 --strictPort) &
        local pid=$!
        PIDS+=("$pid")
        log_blue "Blue frontend PID: $pid"
    fi
}

start_red_frontend() {
    local dir="$ROOT_DIR/red_agent/frontend"
    if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
        log_red "Starting Red frontend on port 5173..."
        (cd "$dir" && npm run dev -- --port 5173 --strictPort) &
        local pid=$!
        PIDS+=("$pid")
        log_red "Red frontend PID: $pid"
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local attempts=0
    local max=30
    while ! (echo >/dev/tcp/localhost/$port) 2>/dev/null; do
        attempts=$((attempts + 1))
        if [ $attempts -ge $max ]; then
            log_warn "$name (port $port) did not start within ${max}s"
            return 1
        fi
        sleep 1
    done
    log_info "$name is ready on port $port"
    return 0
}

print_urls() {
    echo ""
    echo -e "${CYAN}${BOLD}───���──────────────────────────────────────────────────────${NC}"
    echo -e "${CYAN}${BOLD}  Services Running:${NC}"
    echo -e "${CYAN}${BOLD}─────────────────────────────────────────��────────────────${NC}"
    echo ""
    echo -e "  ${RED}${BOLD}Red Agent${NC}"
    echo -e "    Backend API:  ${BOLD}http://localhost:8001${NC}"
    echo -e "    Health check: http://localhost:8001/health"
    echo -e "    WebSocket:    ws://localhost:8001/ws/red"
    if [ "${HAS_NODE:-0}" = "1" ]; then
        echo -e "    Dashboard:    ${BOLD}http://localhost:5173${NC}"
    fi
    echo ""
    echo -e "  ${BLUE}${BOLD}Blue Agent${NC}"
    echo -e "    Backend API:  ${BOLD}http://localhost:8002${NC}"
    echo -e "    Health check: http://localhost:8002/health"
    echo -e "    WebSocket:    ws://localhost:8002/ws/blue"
    echo -e "    API Docs:     http://localhost:8002/docs"
    if [ "${HAS_NODE:-0}" = "1" ]; then
        echo -e "    Dashboard:    ${BOLD}http://localhost:5174${NC}"
    fi
    echo ""
    echo -e "  ${BLUE}Blue API Routes:${NC}"
    echo -e "    /defend/*       Defense actions (close_port, harden, isolate)"
    echo -e "    /patch/*        Patch management (apply, verify)"
    echo -e "    /scan/*         Asset inventory, vulnerabilities, stats"
    echo -e "    /environment/*  Cloud/OnPrem/Hybrid alerts & monitoring"
    echo -e "    /strategy/*     Defense plans, evolution metrics, status"
    echo ""
    echo -e "${CYAN}${BOLD}─────────��─────────────────────────────────��──────────────${NC}"
    echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
    echo -e "${CYAN}${BOLD}──────────���──────────────────────────���────────────────────${NC}"
    echo ""
}

# ─�� Usage / mode selection ───────────────────────────────────────────

usage() {
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  all       Start all services (default)"
    echo "  blue      Start Blue Agent only (backend + frontend)"
    echo "  red       Start Red Agent only (backend + frontend)"
    echo "  backends  Start both backends only (no frontends)"
    echo "  docker    Start everything via Docker Compose"
    echo "  test      Run all Blue Agent tests"
    echo ""
    exit 0
}

# ── Test runner ──────────────────────────────────────────────────────

run_tests() {
    banner
    log_info "Running Blue Agent test suite..."
    echo ""

    PYTHONPATH="$ROOT_DIR" $PYTHON tests/test_blue/test_detection.py
    echo ""
    PYTHONPATH="$ROOT_DIR" $PYTHON tests/test_blue/test_response.py
    echo ""
    PYTHONPATH="$ROOT_DIR" $PYTHON tests/test_blue/test_patching.py

    echo ""
    log_info "All tests complete."
    exit 0
}

# ── Docker mode ���────────────────────────���────────────────────────────

run_docker() {
    banner
    if ! command -v docker &>/dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi
    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
        log_error "Docker Compose not found."
        exit 1
    fi

    setup_env
    log_info "Starting all services via Docker Compose..."
    echo ""

    if docker compose version &>/dev/null 2>&1; then
        docker compose up --build
    else
        docker-compose up --build
    fi
    exit 0
}

# ── Main ─────���────────────────────────────────────���──────────────────

MODE="${1:-all}"

case "$MODE" in
    -h|--help|help) usage ;;
    test)           detect_python; run_tests ;;
    docker)         run_docker ;;
esac

banner
detect_python

HAS_NODE=0
if detect_node && detect_npm; then
    HAS_NODE=1
fi

echo ""

# Setup
setup_env
install_python_deps

if [ "$HAS_NODE" = "1" ]; then
    case "$MODE" in
        all|blue) install_frontend_deps "$ROOT_DIR/blue_agent/frontend" "Blue" ;;
    esac
    case "$MODE" in
        all|red) install_frontend_deps "$ROOT_DIR/red_agent/frontend" "Red" ;;
    esac
fi

echo ""

# Load .env into shell so child processes inherit the vars
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
    log_info "Loaded environment from .env"
fi

# Free ports before starting
case "$MODE" in
    all)      free_all_ports 8001 8002 5173 5174 ;;
    blue)     free_all_ports 8002 5174 ;;
    red)      free_all_ports 8001 5173 ;;
    backends) free_all_ports 8001 8002 ;;
esac

log_info "Starting services (mode: $MODE)..."
echo ""

# Launch based on mode
case "$MODE" in
    all)
        start_red_backend
        start_blue_backend
        if [ "$HAS_NODE" = "1" ]; then
            sleep 2
            start_red_frontend
            start_blue_frontend
        fi
        ;;
    blue)
        start_blue_backend
        if [ "$HAS_NODE" = "1" ]; then
            sleep 2
            start_blue_frontend
        fi
        ;;
    red)
        start_red_backend
        if [ "$HAS_NODE" = "1" ]; then
            sleep 2
            start_red_frontend
        fi
        ;;
    backends)
        start_red_backend
        start_blue_backend
        ;;
    *)
        log_error "Unknown mode: $MODE"
        usage
        ;;
esac

# Wait for backends to be ready
sleep 2
case "$MODE" in
    all|backends)
        wait_for_port 8001 "Red backend"
        wait_for_port 8002 "Blue backend"
        ;;
    blue)
        wait_for_port 8002 "Blue backend"
        ;;
    red)
        wait_for_port 8001 "Red backend"
        ;;
esac

print_urls

# Keep running until Ctrl+C
wait
