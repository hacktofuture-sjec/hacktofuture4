#!/usr/bin/env bash
# Hackathon: start API + open docs (and optional slides), then run demo once.
# Usage:
#   chmod +x start-presentation.sh && ./start-presentation.sh
#   ./start-presentation.sh ~/Desktop/PipelineMedic-slides.pdf
# Env: PIPELINEMEDIC_PRESENTATION=/path/to/slides.pdf  (if no first arg)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

HOST="${PIPELINEMEDIC_HOST:-127.0.0.1}"
PORT="${PIPELINEMEDIC_PORT:-8000}"
BASE="http://${HOST}:${PORT}"
SLIDES="${1:-${PIPELINEMEDIC_PRESENTATION:-}}"
NO_BROWSER="${PIPELINEMEDIC_NO_BROWSER:-0}"

open_url() {
  if [[ "${NO_BROWSER}" == "1" ]]; then
    echo "  (browser skipped) ${1}"
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1"
  else
    echo "  Open in browser: ${1}"
  fi
}

open_file() {
  if [[ -z "${SLIDES}" ]]; then
    return 0
  fi
  if [[ ! -f "${SLIDES}" ]]; then
    echo "Warning: presentation file not found: ${SLIDES}" >&2
    return 0
  fi
  if [[ "${NO_BROWSER}" == "1" ]]; then
    echo "  Slides path: ${SLIDES}"
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "${SLIDES}"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${SLIDES}"
  else
    echo "  Open slides: ${SLIDES}"
  fi
}

if [[ -f "${ROOT}/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT}/.venv/bin/activate"
fi

if [[ ! -f "${ROOT}/.env" ]] && [[ -f "${ROOT}/.env.example" ]]; then
  echo "Tip: copy .env.example to .env and set keys for full demo (Groq, Telegram)." >&2
fi

echo "Starting PipelineMedic at ${BASE} ..."
python "${ROOT}/main.py" &
SERVER_PID=$!

cleanup() {
  if kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 60); do
  if curl -sf "${BASE}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -sf "${BASE}/" >/dev/null 2>&1; then
  echo "Error: server did not become ready at ${BASE}/" >&2
  exit 1
fi

echo ""
echo "PipelineMedic — presentation mode"
echo "  • Health:     ${BASE}/"
echo "  • API docs:   ${BASE}/docs"
echo "  • Webhook:    POST ${BASE}/webhook"
echo ""

open_url "${BASE}/docs"
open_file

if [[ -x "${ROOT}/demo.sh" ]]; then
  echo "Running demo webhook POST (sample failing log) ..."
  echo ""
  PIPELINEMEDIC_URL="${BASE}" "${ROOT}/demo.sh" || true
  echo ""
else
  echo "demo.sh not executable; run: chmod +x demo.sh && PIPELINEMEDIC_URL=${BASE} ./demo.sh"
  echo ""
fi

echo "Server running (PID ${SERVER_PID}). Press Enter to stop."
read -r _
