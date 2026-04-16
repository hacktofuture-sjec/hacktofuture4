# Team Sphinx | Argo-Agentic Intelligence 🌊

## Problem Statement / Idea
* **What is the problem?**
Oceanographic telemetry from the Argo float network is often siloed in complex, technical formats, making it difficult for researchers to query data using natural language or perform high-speed spatial-semantic analysis.

* **Why is it important?**
Fast access to metrics like ocean heat content and oxygen anomalies is critical for climate adaptation. Current workflows lack the ability to bridge the gap between native language queries (Hindi/Bengali) and technical SQL databases.

* **Who are the target users?**
Marine data scientists, environmental policy-makers, and researchers requiring offline-first, high-accuracy scientific assistance for deep-ocean telemetry.

## Proposed Solution
* **What are you building?**
We have built the **Agentic Ocean Intelligence Hyperpipeline**—a localized ML framework and Supabase-ready ingestion system that transforms raw telemetry into a RAG-augmented knowledge base.

* **How does it solve the problem?**
By fusing **AutoGluon** deterministic models for query routing and **LangChain** for local LLM orchestration, we automate the path from a researcher's natural language question to a precise SQL or vector-based answer.

* **What makes your solution unique?**
The system is **Sovereign and Cross-Lingual**. It uses **IndicNLP** to translate native queries into English SQL logic and operates entirely on local infrastructure (LM Studio/Ollama) to ensure total data privacy.

## Features
* **Feature 1: Hybrid Routing Engine** – Uses AutoGluon `TabularPredictor` to categorize queries before passing them to LLMs, ensuring high-speed, zero-hallucination routing.
* **Feature 2: Supabase pgvector/PostGIS Integration** – A high-performance importer that enables both 768-dim semantic search and complex spatial queries (e.g., profiles within 200km).
* **Feature 3: Multi-Turn Scientific Memory** – Implements `ConversationBufferWindowMemory` and DiskCache to maintain context throughout complex research sessions.

## Tech Stack
* **Frontend:** Streamlit
* **Backend:** Python 3.10, LangChain, LM Studio, Ollama
* **Database:** Supabase (PostgreSQL + pgvector + PostGIS)
* **APIs / Services:** Local LLM API (localhost:1234), Local Ollama (localhost:11434)
* **Tools / Libraries:** AutoGluon, IndicNLP, Pydantic, Pandas, NetCDF4

## Project Setup Instructions

```bash
# 1. Install Dependencies
pip install autogluon streamlit pandas requests pydantic langchain langchain-openai diskcache psycopg2-binary

# 2. Setup Database Schema
# Ensure 'new.env' is configured with your DIRECT_URL
python argo_import_supabase.py --env-file new.env --data-dir "C:/path/to/data" --setup-only

# 3. Import Data & Generate Embeddings
# Requires Ollama running 'nomic-embed-text'
python argo_import_supabase.py --env-file new.env --data-dir "C:/path/to/data" --embed

# 4. Launch Application
python -m streamlit run hyperpipeline/chat.py
