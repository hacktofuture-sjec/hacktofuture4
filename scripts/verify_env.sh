#!/bin/bash
# VoxBridge — Environment Verification Script
# Run this after starting all services to verify health.
set -e

echo "========================================"
echo "  VoxBridge — Service Health Check"
echo "========================================"

# Node 3: Elasticsearch
echo -n "[Node 3] Elasticsearch ... "
ES_HEALTH=$(curl -s http://localhost:9200/_cluster/health 2>/dev/null || echo "DOWN")
if echo "$ES_HEALTH" | grep -q '"status"'; then
    echo "OK"
else
    echo "DOWN"
fi

# Node 3: Qdrant
echo -n "[Node 3] Qdrant ... "
Q_HEALTH=$(curl -s http://localhost:6333/health 2>/dev/null || echo "DOWN")
if echo "$Q_HEALTH" | grep -q "qdrant"; then
    echo "OK"
else
    echo "DOWN"
fi

# Node 1: Ollama
echo -n "[Node 1] Ollama ... "
O_HEALTH=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo "DOWN")
if echo "$O_HEALTH" | grep -q "models"; then
    echo "OK"
else
    echo "DOWN"
fi

# Node 2: Webhook Server
echo -n "[Node 2] Webhook Server ... "
W_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs 2>/dev/null || echo "DOWN")
if [ "$W_HEALTH" = "200" ] || [ "$W_HEALTH" = "404" ]; then
    echo "OK (status: $W_HEALTH)"
else
    echo "DOWN"
fi

# GPU Check
if command -v nvidia-smi &>/dev/null; then
    echo -n "[Node 1] GPU VRAM ... "
    VRAM=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
    TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
    PCT=$((VRAM * 100 / TOTAL))
    echo "${VRAM}MB / ${TOTAL}MB (${PCT}%)"
    if [ "$PCT" -gt 85 ]; then
        echo "  WARNING: GPU VRAM > 85%! Consider quantizing model."
    fi
fi

echo ""
echo "========================================"
echo "  Verification complete."
echo "========================================"
