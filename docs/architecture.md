# VoxBridge Architecture

## System Overview

VoxBridge is a voice-native AI support layer for Vertical SaaS platforms. It enables real-time voice calls where an AI agent retrieves domain-specific documentation, executes live API calls via MCP tool calling, and responds with synthesized speech — all within a sub-800ms latency target.

## Node Architecture

```
Caller ──► Twilio ──► Node 2 (Webhook + WSS Proxy)
                            │
                            ▼
                      Node 1 (Agent + LLM + TTS)
                            │
                            ▼
                      Node 3 (Elasticsearch + Qdrant)
```

## Directory Structure

```
├── services/agent/         # FSM, LLM, RAG, TTS, MCP
├── services/webhook/       # Twilio telephony bridge
├── services/knowledge/     # Qdrant + Elasticsearch ingestion
├── infra/                  # Docker compose, Cloudflare config
├── scripts/                # Setup & verification scripts
├── docs/                   # Architecture documentation
└── tests/                  # Cross-service integration tests
```

## Key Performance Targets

| Metric | Target |
|--------|--------|
| End-to-End Latency (P95) | < 800ms |
| LLM TTFT (P95) | < 600ms |
| Deepgram STT | < 300ms |
| Qdrant Retrieval | ~2ms |
| RAG Groundedness | > 0.90 |
