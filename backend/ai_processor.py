"""
ai_processor.py
All Ollama/Llama 3 interactions. Generates startup problem packages from news articles.
"""

import json
import re
import logging
from typing import Dict, List, Optional, Callable

import httpx

from .config import settings

logger = logging.getLogger(__name__)

OLLAMA_URL = f"{settings.OLLAMA_HOST}/api/generate"


# ── Core LLM caller ──────────────────────────────────────────────────────────

async def _llm(prompt: str, max_tokens: int = 1500, json_mode: bool = False) -> str:
    """Call Ollama and return the raw response string."""
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1 if json_mode else 0.65,
            "num_predict": max_tokens,
            "stop": ["<|eot_id|>", "<|end_of_text|>"],
        },
    }
    if json_mode:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


# ── Step 1: Filter ────────────────────────────────────────────────────────────

FILTER_PROMPT = """\
You are a business analyst reviewing news articles to find startup opportunities.

An article is RELEVANT if it mentions ANY of:
- A company failing, shutting down, or struggling with operations
- A data breach, security incident, or compliance problem affecting businesses
- A supply chain, shipping, or logistics disruption  
- A healthcare, hospital, or medical system problem
- A technology gap, adoption challenge, or tool that businesses need
- A regulatory or government burden on companies
- A market where customers have no good options
- A labor shortage, hiring problem, or workforce gap
- Rising costs or inefficiencies in any industry
- A startup or industry trend causing disruption

An article is NOT relevant ONLY if it is PURELY:
- Celebrity gossip or entertainment
- Sports scores or results
- Weather reports
- Pure lifestyle/travel content with zero business angle

When in doubt, mark it as relevant.

Article Title: {title}
Article Content: {content}

Respond ONLY with valid JSON:
{{"relevant": true, "category": "SaaS", "problem_title": "Short Business Problem Title"}}
OR
{{"relevant": false, "category": "", "problem_title": ""}}

Categories: Healthcare, Logistics, FinTech, SaaS, AgriTech, Education, Energy, Manufacturing, HR, Other
"""


async def classify_article(article: Dict) -> Optional[Dict]:
    """Returns classification dict {relevant, category, problem_title} or None."""
    prompt = FILTER_PROMPT.format(
        title=article["title"],
        content=article.get("full_text", article.get("summary", ""))[:800],
    )
    try:
        raw = await _llm(prompt, max_tokens=150, json_mode=True)
        # Try JSON parse first
        try:
            data = json.loads(raw)
            if data.get("relevant") and data.get("problem_title"):
                return data
            elif data.get("relevant") is False:
                return None
        except json.JSONDecodeError:
            pass
        # Fallback: plain-text heuristic — if model said "true" anywhere, accept it
        raw_lower = raw.lower()
        if '"relevant": true' in raw_lower or "relevant: true" in raw_lower:
            # Extract problem_title from raw text
            title_match = re.search(r'problem_title["\s:]+([^"\n,}]{5,80})', raw, re.IGNORECASE)
            ptitle = title_match.group(1).strip('" ') if title_match else article["title"][:80]
            cat_match = re.search(r'category["\s:]+([A-Za-z]+)', raw)
            cat = cat_match.group(1).strip() if cat_match else "Other"
            return {"relevant": True, "category": cat, "problem_title": ptitle}
    except Exception as exc:
        logger.warning("classify_article failed: %s", exc)
    return None


# ── Step 2: Document generators ───────────────────────────────────────────────

async def gen_problem(title: str, category: str, content: str) -> str:
    prompt = f"""\
You are a startup analyst. Write a deep PROBLEM ANALYSIS document based on this news.

Problem Title: {title}
Category: {category}
News Content: {content}

Write EXACTLY these sections separated by === markers:

=== PROBLEM TITLE ===
{title}

=== ROOT CAUSE ===
- [Root cause 1]
- [Root cause 2]
- [Root cause 3]

=== CURRENT INEFFICIENCIES ===
- [Specific inefficiency 1]
- [Specific inefficiency 2]
- [Specific inefficiency 3]

=== WHY EXISTING SOLUTIONS FAIL ===
- [Reason 1]
- [Reason 2]

=== AFFECTED USERS ===
Primary: [user segment]
Secondary: [user segment]

=== MARKET IMPACT ===
[2-3 sentences on economic/operational scale of the problem]

Be technical, specific, and grounded in the news article. No generic statements. Max 500 words."""
    return await _llm(prompt, max_tokens=1200)


async def gen_solution(title: str, category: str, content: str) -> str:
    prompt = f"""\
You are a startup founder. Write a SOLUTION CONCEPT for this business problem.

Problem: {title}
Category: {category}
Context: {content}

Use ONLY free and open-source technologies.

Write EXACTLY these sections:

=== SOLUTION NAME ===
[Short brandable name — 1-3 words]

=== TAGLINE ===
[One compelling line]

=== SOLUTION CONCEPT ===
[6-8 lines: what it does, how it works step by step, who uses it]

=== DIFFERENTIATION ===
- vs existing solution 1: [why better]
- vs existing solution 2: [why better]
- vs generic AI tools: [why better]

=== FEASIBILITY ===
Rating: HIGH
Reason: [2 sentences on why this is buildable with 2-5 engineers]

Max 450 words. Use open-source only."""
    return await _llm(prompt, max_tokens=1100)


async def gen_architecture(solution_name: str, title: str, category: str) -> str:
    prompt = f"""\
You are a system architect. Design a COMPLETE open-source technical architecture.

Project: {solution_name} — solving: {title}
Category: {category}

Use ONLY free/open-source tools. Write these sections:

=== FRONTEND ===
Framework: [Next.js 14 or React + Vite]
UI Library: [shadcn/ui / Mantine / Ant Design]
Key packages: [list 3-5 packages]

=== BACKEND ===
Framework: [FastAPI or Express.js]
Key components: [list 3-4]

=== AI LAYER ===
Model: [Llama 3 8B or Mistral 7B via Ollama]
Usage: [exactly how the model is used in this product]

=== DATABASE ===
Primary: [PostgreSQL or MongoDB or SQLite]
Cache: [Redis — only if truly needed]

=== HOSTING (Free Tier) ===
[Vercel + Render + Neon or Upstash — pick what fits]

=== REQUEST FLOW ===
1. [Frontend action]
2. [Backend receives]
3. [AI processes]
4. [DB stores/reads]
5. [Response returned]

Max 400 words. Be specific with package names."""
    return await _llm(prompt, max_tokens=1000)


async def gen_implementation(solution_name: str, title: str) -> str:
    prompt = f"""\
You are a senior developer. Write a DEVELOPER-READY implementation plan.

Project: {solution_name} — {title}

=== PROJECT STRUCTURE ===
[Folder tree — max 18 lines, use realistic file names]

=== PHASE 1: Foundation (Week 1-2) ===
1. [Step]
2. [Step]
3. [Step]

=== PHASE 2: Core Features (Week 3-5) ===
1. [Step]
2. [Step]
3. [Step]
4. [Step]

=== PHASE 3: AI Integration (Week 6-7) ===
1. [Step]
2. [Step]
3. [Step]

=== PHASE 4: Frontend + Deploy (Week 8-10) ===
1. [Step]
2. [Step]
3. [Step]

=== KEY MODULES ===
- [Module name]: [what it does]
- [Module name]: [what it does]
- [Module name]: [what it does]
- [Module name]: [what it does]
- [Module name]: [what it does]

Max 500 words. Use real function and file names."""
    return await _llm(prompt, max_tokens=1200)


async def gen_monetization(solution_name: str, title: str, category: str) -> str:
    prompt = f"""\
You are a monetization strategist. Write a MONETIZATION PLAN.

Startup: {solution_name}
Problem: {title}
Category: {category}

=== REVENUE MODEL ===
[Primary + secondary revenue streams]

=== PRICING TIERS ===
Free: [what is free]
Starter $[X]/mo: [features]
Pro $[X]/mo: [features]
Enterprise: Custom — [features]

=== GO-TO-MARKET (3 phases) ===
Phase 1: [Month 1-3]
Phase 2: [Month 4-6]
Phase 3: [Month 7-12]

=== TARGET BUYER ===
[Who buys it and why they pay]

=== UNIT ECONOMICS ===
CAC: ~$[X]
LTV: ~$[X]
Gross Margin: ~[X]%

Max 400 words. Realistic pricing for the {category} market."""
    return await _llm(prompt, max_tokens=900)


def _extract_solution_name(solution_txt: str) -> str:
    """Pull the solution name from the gen_solution output."""
    m = re.search(r"=== SOLUTION NAME ===\s*\n(.+)", solution_txt)
    if m:
        return m.group(1).strip().strip("*").strip()
    return "OpenSolve"


# ── Step 3: Main pipeline ─────────────────────────────────────────────────────

async def generate_package(article: Dict, classification: Dict) -> Optional[Dict]:
    """Generate the full 6-document + code package for one article."""
    title = classification.get("problem_title", article["title"])
    category = classification.get("category", "Other")
    content = article.get("full_text", article.get("summary", ""))[:1500]

    try:
        problem_txt = await gen_problem(title, category, content)
        solution_txt = await gen_solution(title, category, content)
        solution_name = _extract_solution_name(solution_txt)
        architecture_txt = await gen_architecture(solution_name, title, category)
        implementation_txt = await gen_implementation(solution_name, title)
        monetization_txt = await gen_monetization(solution_name, title, category)

        article_md = (
            f"# {article['title']}\n\n"
            f"**Source:** {article['source']}  \n"
            f"**Published:** {article.get('published', 'N/A')}  \n"
            f"**URL:** {article.get('url', 'N/A')}\n\n"
            f"---\n\n## Summary\n\n{article.get('summary', '')}\n\n"
            f"---\n\n## Full Content\n\n{content}\n\n"
            f"---\n*Sourced from {article['source']}. "
            f"This article is the basis for the business problem package.*\n"
        )

        return {
            "title": title,
            "category": category,
            "solution_name": solution_name,
            "source_name": article["source"],
            "source_url": article.get("url", ""),
            "published_at": article.get("published", ""),
            "article_md": article_md,
            "problem_txt": problem_txt,
            "solution_txt": solution_txt,
            "architecture_txt": architecture_txt,
            "implementation_plan_txt": implementation_txt,
            "monetization_txt": monetization_txt,
        }
    except Exception as exc:
        logger.error("generate_package failed for '%s': %s", title, exc)
        return None


async def process_articles(
    articles: List[Dict],
    db,
    log_fn: Callable,
    state: Dict,
) -> None:
    """Main pipeline: filter → generate → save."""
    from .models import Problem
    from .sample_code_generator import generate_code_skeleton

    relevant = []

    # ── Phase 1: Filter ──────────────────────────────────────────────────────
    log_fn(f"Filtering {len(articles)} articles for business relevance...")
    for article in articles[: settings.MAX_ARTICLES_PER_FETCH]:
        log_fn(f"  Checking: {article['title'][:65]}...")
        classification = await classify_article(article)
        if classification:
            log_fn(
                f"  RELEVANT [{classification['category']}] -> "
                f"{classification['problem_title'][:55]}",
                "success",
            )
            relevant.append((article, classification))
        else:
            log_fn(f"  Skipped (not a business problem)")

        if len(relevant) >= settings.MAX_PROBLEMS_TO_GENERATE:
            break

    if not relevant:
        log_fn("No relevant business articles found in this batch.", "warning")
        return

    state["total"] = len(relevant)
    log_fn(f"Found {len(relevant)} relevant articles. Generating packages...")

    # ── Phase 2: Generate ────────────────────────────────────────────────────
    for i, (article, classification) in enumerate(relevant):
        title = classification.get("problem_title", article["title"])
        log_fn(f"[{i+1}/{len(relevant)}] Generating: {title[:55]}...")

        # Skip duplicates
        existing = db.query(Problem).filter(Problem.source_url == article.get("url", "")).first()
        if existing:
            log_fn(f"  Already in DB, skipping")
            state["completed"] = state.get("completed", 0) + 1
            state["progress"] = int((state["completed"] / state["total"]) * 100)
            continue

        package = await generate_package(article, classification)
        if not package:
            log_fn(f"  Package generation failed, skipping", "error")
            continue

        log_fn(f"  Generating code skeleton...")
        code = await generate_code_skeleton(package)

        # Build unique slug
        raw_slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:55].strip("-")
        slug = raw_slug
        counter = 1
        while db.query(Problem).filter(Problem.slug == slug).first():
            slug = f"{raw_slug}-{counter}"
            counter += 1

        problem = Problem(
            slug=slug,
            title=package["title"],
            category=package["category"],
            source_name=package["source_name"],
            source_url=package["source_url"],
            published_at=package["published_at"],
            article_md=package["article_md"],
            problem_txt=package["problem_txt"],
            solution_txt=package["solution_txt"],
            architecture_txt=package["architecture_txt"],
            implementation_plan_txt=package["implementation_plan_txt"],
            monetization_txt=package["monetization_txt"],
            **code,
        )
        db.add(problem)
        db.commit()

        state["completed"] = state.get("completed", 0) + 1
        state["progress"] = int((state["completed"] / state["total"]) * 100)
        log_fn(f"  Saved: {slug}", "success")
