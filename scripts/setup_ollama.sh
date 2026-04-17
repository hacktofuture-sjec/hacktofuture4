#!/bin/bash
# Node 1: Ollama setup script
# Install Ollama, pull Llama 3.1 8B, verify GPU load

set -e

echo "[Ollama] Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

echo "[Ollama] Starting Ollama server in background..."
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /tmp/ollama.log 2>&1 &
echo "Ollama PID: $!"

echo "[Ollama] Pulling llama3.1:8b model..."
ollama pull llama3.1:8b

echo "[GPU] Checking VRAM usage..."
nvidia-smi

echo ""
echo "[Ollama] Testing inference..."
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.1:8b", "messages": [{"role": "user", "content": "Hello"}]}' \
  | python3 -m json.tool

echo ""
echo "[Ollama] Setup complete. VRAM usage should be < 85% (~20.4 GB on RTX 4090)."
