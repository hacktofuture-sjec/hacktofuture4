# Vector++ 🚀

**Autonomous Feedback-to-Fix Intelligence Platform**

Vector++ ingests user feedback from GitHub, Reddit, and Twitter, clusters it with DBSCAN over vector embeddings, runs a 4-agent AI pipeline (Analyzer → Planner → Coder → Tester), and opens a GitHub pull request — fully automatically.

---

## Architecture

```
Feedback Sources         Clustering Engine         Multi-Agent Pipeline       Output
─────────────────        ─────────────────         ────────────────────       ──────
GitHub Issues    ──┐                               1. Analyzer
Reddit Posts     ──┼──► Embed (sentence-      ──► 2. Planner          ──►  GitHub PR
Twitter/Nitter   ──┤    transformers)              3. Coder
HackerNews       ──┘    + DBSCAN clustering        4. Tester (+ sandbox)
                         + Priority scoring
```

## Project Structure

```
vectorplusplus/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── ingestion/
│   │   ├── github_scraper.py      # GitHub Issues API
│   │   ├── web_scraper.py         # Reddit, Nitter, HackerNews
│   │   └── normalizer.py          # Dedup and save to DB
│   ├── clustering/
│   │   ├── embedder.py            # sentence-transformers (local)
│   │   └── clusterer.py           # DBSCAN clustering
│   ├── agents/
│   │   ├── analyzer.py            # Root cause analysis (Claude)
│   │   ├── planner.py             # Fix strategy (Claude)
│   │   ├── coder.py               # Code patch writer (Claude)
│   │   └── tester.py              # Test generator (Claude)
│   ├── pipeline/
│   │   └── orchestrator.py        # Connects all agents
│   ├── github_automation/
│   │   └── pr_creator.py          # Opens GitHub PR
│   ├── sandbox/
│   │   └── runner.py              # Docker sandbox for test runs
│   └── database/
│       └── db.py                  # Supabase client singleton
├── frontend/                      # React + Tailwind dashboard
├── docker/
│   └── sandbox.dockerfile         # Isolated test runner
├── docker-compose.yml
├── schema.sql                     # Run this in Supabase SQL editor
└── requirements.txt
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) free account
- An [Anthropic API key](https://console.anthropic.com)
- A [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope

### 2. Database Setup

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the **SQL Editor** in your project dashboard
3. Run the contents of [`schema.sql`](./schema.sql)

### 3. Backend Setup

```bash
cd vectorplusplus

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your credentials
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, GITHUB_TOKEN
```

### 4. Start the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`  
API docs at `http://localhost:8000/docs`

### 5. Start the Frontend

```bash
cd frontend
npm install
npm start
```

Frontend will be at `http://localhost:3000`

---

## Using the Dashboard

1. **Enter a GitHub repo** (e.g. `facebook/react`) and a **search query** (e.g. `login bug`)
2. Click **Ingest Feedback** — this scrapes GitHub issues, Reddit, HackerNews, and Twitter, embeds them locally, and clusters similar items
3. Go to **Dashboard** to see the priority-ranked issue clusters appear
4. Click **Run Pipeline →** on the highest-priority cluster
5. Watch the 4 agent dots (Analyzer → Planner → Coder → Tester) light up in sequence
6. A **Pull Request link** appears when done — click to view it on GitHub
7. Check **Pipeline** tab for full per-agent output and step details
8. Check **Pull Requests** tab for all generated PRs

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard summary stats |
| GET | `/api/feedback` | All collected feedback |
| GET | `/api/clusters` | All clusters (priority ordered) |
| GET | `/api/clusters/{id}/agents` | Agent run timeline |
| GET | `/api/prs` | All generated PRs |
| POST | `/api/ingest` | Trigger full ingestion |
| POST | `/api/pipeline/run` | Run pipeline for a cluster |
| POST | `/api/cluster/reset` | Re-cluster with new params |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase anon/service key |
| `ANTHROPIC_API_KEY` | Claude API key |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope |

---

## Tech Stack

| Layer | Tool | Cost |
|-------|------|------|
| LLM | Claude (Anthropic) | Free tier / pay-as-you-go |
| Embeddings | `sentence-transformers` (local) | **Free** |
| Vector DB | `pgvector` on PostgreSQL | **Free** (Supabase) |
| DB Hosting | Supabase free tier | **Free** (500MB) |
| Clustering | DBSCAN (scikit-learn) | **Free** |
| Scraping | requests + BeautifulSoup | **Free** |
| Backend | FastAPI + Uvicorn | **Free** |
| Frontend | React + Tailwind CSS | **Free** |
| GitHub API | PyGitHub | **Free** (public repos) |
| Sandbox | Docker | **Free** |

---

## License

MIT
