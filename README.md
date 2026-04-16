# Startup Problem Marketplace

A fully local web app that:
1. **Fetches** live news from free RSS feeds (no API key needed)
2. **Filters** articles using Llama 3 — only real business problems pass
3. **Generates** full startup packages: problem analysis, solution, architecture, build plan, monetization, and sample code
4. **Serves** them as downloadable ZIP files through a beautiful marketplace UI

---

## ⚠️ IMPORTANT: Setup Ollama First

This app requires **Ollama** running locally to generate startup packages. Without it, article filtering will fail.

### 1. Install Ollama
- Download from https://ollama.ai
- Install for your OS (Windows/Mac/Linux)
- Leave the default settings (listens on `http://localhost:11434`)

### 2. Pull the Llama 3 Model
Open **PowerShell** or **Terminal** and run:
```powershell
ollama pull llama3:8b
```
⏱️ **First time:** Takes 5-15 minutes (downloads ~4.7GB)

### 3. Start Ollama Server
In the same terminal, run:
```powershell
ollama serve
```
✅ You should see: `Listening on 127.0.0.1:11434`

**Keep this terminal open** — the backend needs it running at all times.

---

## Quick Start (Windows)

Once Ollama is running:

```bat
start.bat
```

Then open **http://localhost:5173** and click **"Fetch Latest News"**.

---

## Manual Start

**Terminal 1 — Ollama (keep running):**
```bash
ollama serve
```

**Terminal 2 — Backend:**
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Requirements

| Tool | Version | Purpose | Link |
|------|---------|---------|------|
| Python | 3.11+ | Backend API | https://python.org |
| Node.js | 18+ | Frontend dev server | https://nodejs.org |
| Ollama | latest | Local AI inference | https://ollama.ai |
| `llama3:8b` | — | AI model for article analysis | `ollama pull llama3:8b` |

---

## How It Works

```
1. You click "Fetch Latest News"
   ↓
2. Backend fetches ~60 articles from RSS feeds (BBC, TechCrunch, etc.)
   ↓
3. Ollama + Llama 3 analyzes each article:
   - Is this a real business problem? (filters entertainment/sports)
   - What category? (SaaS, Healthcare, Logistics, etc.)
   - What's the core problem?
   ↓
4. For RELEVANT articles, backend generates 6 documents:
   - Problem Analysis (root causes, inefficiencies, market impact)
   - Solution Concept (problem-specific startup idea)
   - System Architecture (open-source tech stack)
   - Implementation Plan (7-10 week phased approach)
   - Monetization Strategy (pricing tiers, GTM phases)
   - Sample Code (FastAPI backend + React frontend skeleton)
   ↓
5. Creates a ZIP file with all 6 documents + code templates
   ↓
6. User can download and "buy" problems (e-commerce style)
```

---

## What's in Each ZIP Download

```
<problem-slug>/
├── README.md                 ← Overview and quick start
├── article.md                ← Original news article
├── problem.txt               ← Root cause analysis
├── solution.txt              ← Startup solution concept
├── architecture.txt          ← Open-source tech stack
├── implementation_plan.txt   ← Step-by-step build guide
├── monetization.txt          ← Revenue model + pricing
└── sample_code/
    ├── README.md             ← Code setup instructions
    ├── backend/
    │   ├── main.py           ← FastAPI skeleton (problem-specific)
    │   ├── models.py         ← Domain data models
    │   ├── services.py       ← Business logic stubs
    │   └── requirements.txt
    └── frontend/
        ├── src/App.jsx       ← React component skeleton
        ├── package.json
        └── vite.config.js
```

---

## News Sources (All Free, No API Key)

- BBC Business RSS
- TechCrunch
- Hacker News (hnrss.org)
- The Verge
- Ars Technica

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/news/fetch` | Trigger news fetch + AI processing |
| GET | `/api/news/status` | Current processing status + logs |
| GET | `/api/problems` | List all generated packages |
| GET | `/api/problems/{id}` | Single package detail |
| GET | `/api/problems/{id}/download` | Download ZIP |
| DELETE | `/api/problems/{id}` | Remove a package |

---

## Tech Stack (100% Open-Source)

| Layer | Tool |
|-------|------|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Python |
| AI | Llama 3 8B via Ollama (local) |
| News | feedparser + RSS (free) |
| Database | SQLite via SQLAlchemy |
| ZIP | Python stdlib `zipfile` |
