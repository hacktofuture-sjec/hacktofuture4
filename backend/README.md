# Backend (Engineer B)

## Scope
- FastAPI API and SSE endpoints
- Controller Kernel and swarm orchestration
- Native Permission Gate (HITL)
- Memory layer and audit trail

## Start
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Milvus Vector DB Setup

1. Start Milvus from the repository root:

```bash
cd infra
docker compose up -d milvus
```

2. Configure retrieval mode and vector settings in `.env`:

```bash
RETRIEVAL_MODE=hybrid
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_COLLECTION_NAME=uniops_documents
EMBEDDING_PROVIDER=deterministic
```

3. Verify and rebuild vector index:

```bash
curl http://127.0.0.1:8000/api/vector/status
curl -X POST http://127.0.0.1:8000/api/vector/rebuild
```

## LLM Module

Reasoning and execution assessment providers are selected via `LLM_PROVIDER`:

- `groq` (requires `GROQ_API_KEY`)
- `apfel` (requires `APFEL_BASE_URL` and `APFEL_API_KEY`)

Retrieval query expansion, reasoning synthesis, and execution assessment are all wired through the shared LLM client module in `backend/src/adapters/llm_client.py`.
