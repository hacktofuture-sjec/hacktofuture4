"""
sample_code_generator.py
Generates a problem-specific FastAPI + React skeleton that goes inside the ZIP.
"""

import logging
from typing import Dict

from .ai_processor import _llm

logger = logging.getLogger(__name__)


BACKEND_CODE_PROMPT = """\
You are a senior Python developer. Generate a FastAPI starter file for this startup project.

Project: {solution_name}
Problem it solves: {title}
Category: {category}

Write a complete, runnable `main.py` that:
1. Uses FastAPI with clear route names specific to this domain
2. Has 3-5 API endpoints relevant to the problem (GET, POST, etc.)
3. Uses Pydantic models for request/response bodies
4. Includes # TODO comments explaining what each function should do
5. Imports: fastapi, pydantic, sqlalchemy (stubs are fine)
6. Has a main block: if __name__ == "__main__": uvicorn.run(...)

Make the route names, model fields, and logic specific to *this* problem domain.
Do NOT write generic placeholder code. Write code that reflects the actual business domain.

Output ONLY the Python code, no explanation."""


FRONTEND_CODE_PROMPT = """\
You are a senior React developer. Write a starter App.jsx for this startup.

Project: {solution_name}
Problem it solves: {title}
Category: {category}

Write a complete React functional component that:
1. Uses React hooks (useState, useEffect)
2. Has a UI relevant to this domain (a form, a list, a dashboard section)
3. Fetches data from `http://localhost:8000/api/` endpoints
4. Includes // TODO comments for the actual implementation
5. Has basic inline styles (no external CSS libs needed)
6. Is immediately runnable

Make the component fields, labels, and logic specific to the {category} domain.
Output ONLY the JSX code starting with: import React, {{ useState, useEffect }} from 'react'"""


async def generate_code_skeleton(package: Dict) -> Dict:
    """Generate all code files for the sample_code/ folder."""
    solution_name = package.get("solution_name", "OpenSolve")
    title = package["title"]
    category = package["category"]

    # Backend main.py
    try:
        backend_main = await _llm(
            BACKEND_CODE_PROMPT.format(
                solution_name=solution_name, title=title, category=category
            ),
            max_tokens=1400,
        )
    except Exception as e:
        logger.warning("Backend code gen failed: %s", e)
        backend_main = _fallback_backend(solution_name, title)

    # Frontend App.jsx
    try:
        frontend_app = await _llm(
            FRONTEND_CODE_PROMPT.format(
                solution_name=solution_name, title=title, category=category
            ),
            max_tokens=1200,
        )
    except Exception as e:
        logger.warning("Frontend code gen failed: %s", e)
        frontend_app = _fallback_frontend(solution_name, title)

    requirements = (
        "fastapi==0.109.2\n"
        "uvicorn[standard]==0.27.1\n"
        "sqlalchemy==2.0.27\n"
        "pydantic==2.6.1\n"
        "httpx==0.26.0\n"
        "python-dotenv==1.0.1\n"
    )

    backend_models = f"""\
# models.py — Data models for {solution_name}
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# TODO: Define your domain-specific models below
# Example:
# class Record(Base):
#     __tablename__ = "records"
#     id = Column(Integer, primary_key=True)
#     title = Column(String(200))
#     created_at = Column(DateTime, server_default=func.now())
"""

    backend_services = f"""\
# services.py — Business logic for {solution_name}
# Problem: {title}


class {solution_name.replace(' ', '')}Service:
    \"\"\"Core business logic for {solution_name}.\"\"\"

    async def process(self, data: dict) -> dict:
        \"\"\"
        TODO: Implement the core processing logic here.
        
        Steps:
        1. Validate input data
        2. Apply business rules
        3. Interact with external APIs or databases
        4. Return structured result
        \"\"\"
        raise NotImplementedError("Implement this method")

    async def fetch_all(self) -> list:
        \"\"\"TODO: Fetch all records from the database.\"\"\"
        raise NotImplementedError

    async def get_by_id(self, record_id: int) -> dict:
        \"\"\"TODO: Fetch a single record by ID.\"\"\"
        raise NotImplementedError
"""

    sample_readme = f"""\
# {solution_name} — Starter Code

> **Problem:** {title}

This is a code skeleton generated to help you get started building the solution.
See the parent directory for the full problem analysis, architecture, and build plan.

## Quick Start

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5174
```

## What's Inside

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI routes — domain-specific TODOs |
| `backend/models.py` | SQLAlchemy data models |
| `backend/services.py` | Business logic stubs |
| `backend/requirements.txt` | Python dependencies |
| `frontend/src/App.jsx` | React UI component |

## Next Steps

1. Read `../problem.txt` for the full problem breakdown
2. Review `../architecture.txt` for the complete tech stack
3. Follow `../implementation_plan.txt` phase by phase
4. Reference `../solution.txt` for the product concept

## Tech Stack (All Open-Source)

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React 18 + Vite
- **AI**: Llama 3 8B via Ollama (local)
- **Deploy**: Docker Compose → Vercel + Render (free tier)
"""

    return {
        "sample_backend_main": backend_main,
        "sample_backend_models": backend_models,
        "sample_backend_services": backend_services,
        "sample_backend_requirements": requirements,
        "sample_frontend_app": frontend_app,
        "sample_readme": sample_readme,
    }


# ── Fallback templates (if LLM fails) ─────────────────────────────────────────

def _fallback_backend(solution_name: str, title: str) -> str:
    return f"""\
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="{solution_name}",
    description="Solving: {title}",
    version="0.1.0",
)


class ItemCreate(BaseModel):
    # TODO: Add fields relevant to the problem domain
    name: str
    description: Optional[str] = None


class ItemOut(ItemCreate):
    id: int


# In-memory store — replace with a real database
_store: List[dict] = []
_counter = 0


@app.get("/")
def health():
    return {{"status": "ok", "project": "{solution_name}"}}


@app.get("/api/items", response_model=List[ItemOut])
def list_items():
    # TODO: Fetch from database
    return _store


@app.post("/api/items", response_model=ItemOut)
def create_item(item: ItemCreate):
    # TODO: Validate and save to database
    global _counter
    _counter += 1
    record = {{"id": _counter, **item.model_dump()}}
    _store.append(record)
    return record


@app.get("/api/items/{{item_id}}", response_model=ItemOut)
def get_item(item_id: int):
    # TODO: Fetch from database by ID
    for record in _store:
        if record["id"] == item_id:
            return record
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
"""


def _fallback_frontend(solution_name: str, title: str) -> str:
    return f"""\
import React, {{ useState, useEffect }} from 'react'

// {solution_name} — Frontend starter
// Problem: {title}

export default function App() {{
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({{ name: '', description: '' }})

  useEffect(() => {{
    // TODO: Fetch initial data
    fetchItems()
  }}, [])

  async function fetchItems() {{
    setLoading(true)
    try {{
      const res = await fetch('http://localhost:8000/api/items')
      const data = await res.json()
      setItems(data)
    }} catch (err) {{
      console.error('Fetch failed:', err)
    }} finally {{
      setLoading(false)
    }}
  }}

  async function handleSubmit(e) {{
    e.preventDefault()
    // TODO: Submit to backend
    const res = await fetch('http://localhost:8000/api/items', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify(form),
    }})
    if (res.ok) {{
      fetchItems()
      setForm({{ name: '', description: '' }})
    }}
  }}

  return (
    <div style={{{{ fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto', padding: 24 }}}}>
      <h1>{solution_name}</h1>
      <p style={{{{ color: '#666' }}}}>Solving: {title}</p>

      <form onSubmit={{handleSubmit}} style={{{{ marginTop: 24, marginBottom: 32 }}}}>
        <input
          placeholder="Name"
          value={{form.name}}
          onChange={{e => setForm(f => ({{ ...f, name: e.target.value }}))}}
          style={{{{ marginRight: 8, padding: 8 }}}}
        />
        <input
          placeholder="Description"
          value={{form.description}}
          onChange={{e => setForm(f => ({{ ...f, description: e.target.value }}))}}
          style={{{{ marginRight: 8, padding: 8 }}}}
        />
        <button type="submit" style={{{{ padding: '8px 16px' }}}}>Add</button>
      </form>

      {{loading && <p>Loading...</p>}}
      
      <ul>
        {{items.map(item => (
          <li key={{item.id}}>
            <strong>{{item.name}}</strong>
            {{item.description && <span> — {{item.description}}</span>}}
          </li>
        ))}}
      </ul>
    </div>
  )
}}
"""
