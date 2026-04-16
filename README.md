# Silicon Colosseum

> *An autonomous AI-vs-AI cyber battle arena where a Red (attacker) agent fights to breach a live network of vulnerable services — while a Blue (defender) agent learns, adapts, and fights back in real-time.*

---

## Problem Statement / Idea

**What is the problem?**  
Cybersecurity teams train reactively — they study past attacks after the damage is done. Existing simulation tools are either static (scripted rules) or disconnected from realistic network environments. There is no platform that lets you observe, in real time, two AI agents clashing over a live, intentionally vulnerable network while measuring every detection, evasion, and countermeasure.

**Why is it important?**  
Defenders need to understand attacker behaviour before a real breach happens. Conversely, Red Team exercises are expensive, slow, and require skilled human operators. An autonomous arena that continuously runs adversarial battles — and lets Blue *learn* from every round — compresses months of Red Team experience into minutes.

**Who are the target users?**
- Cybersecurity researchers studying adversarial machine learning
- Blue Team operators who want to benchmark and train detection models
- Educators and students learning offensive/defensive security concepts
- CTF (Capture The Flag) enthusiasts and challenge designers

---

## Proposed Solution

**What are we building?**  
Silicon Colosseum is a fully containerised, real-time AI cyber-battle simulation platform. A **Red Agent** (Reinforcement Learning — PPO) autonomously executes multi-stage attack kill chains against six intentionally vulnerable Docker services. A **Blue Agent** (XGBoost + Isolation Forest + online SGD) monitors live container logs, classifies threats, and deploys countermeasures — all without any human input.

**How does it solve the problem?**  
- The Red Agent progresses through a MITRE ATT&CK-mapped kill chain: Reconnaissance → Initial Access → Credential Access → Collection → Lateral Movement → Exfiltration.
- The Blue Agent reads real Docker container logs, extracts 12-dimensional feature vectors, and makes sub-second detection + response decisions.
- **Crucially, Blue learns persistently.** After each battle, its online model is saved to disk. Every new run starts with everything Blue learned in previous rounds — making it progressively harder for Red to succeed. Resetting wipes this memory, resetting the arms race.
- A live WebSocket dashboard streams every event — Red attacks, Blue alerts, virtual IP blocks, WAF rule insertions, and kill-chain progression — to an interactive React frontend in real time.

**What makes our solution unique?**
- **True online learning** — Blue's SGDClassifier incrementally updates its weights mid-battle from ground-truth labels, and persists those weights across runs.
- **Real Docker traffic** — attacks hit actual HTTP/TCP endpoints on live containers, not simulations of simulations.
- **MITRE ATT&CK integration** — every Red action is mapped to a tactic ID and kill-chain stage, giving the battle strategic structure.
- **Virtual countermeasures with RL feedback** — Blue's IP blocks are reflected back into Red's RL observation space, forcing the PPO model to adapt and pivot.
- **Human traffic simulation** — a Human Simulator fires benign requests concurrently, measuring Blue's false-positive rate against real user traffic.

---

## Features

- 🤖 **Autonomous Red Agent** — PPO-trained attacker executing SQLi, path traversal, JWT forgery, Redis exploitation, Nginx alias traversal, and multi-step credential chaining
- 🛡 **Adaptive Blue Agent** — XGBoost + IsolationForest ensemble blended with an online SGDClassifier that sharpens with each battle
- 📚 **Persistent Cross-Run Learning** — Blue saves its neural weights after every round; future runs start already trained, getting harder to beat over time
- 🔄 **Hard Reset** — one click wipes Blue's memory, restarting the learning arms race from zero
- 🗺 **MITRE ATT&CK Kill Chain** — 6-stage attack progression (Reconnaissance → Exfiltration) with real tactic IDs
- 🧑 **Human Traffic Simulator** — concurrent benign requests measure false-positive rates
- 🚫 **Virtual IP Blocking & Rate Limiting** — countermeasures logged visibly in the dashboard and fed back into Red's RL environment
- 🛡 **Dynamic WAF Rules** — Blue adds rules mid-battle based on detected attack classes
- ⚡ **Live WebSocket Dashboard** — real-time event stream: Red actions, Blue alerts, kill-chain map, metrics (MTTD, MTTR, block rate, flags captured)
- 📊 **Battle Reports** — end-of-battle JSON + Markdown reports with full statistics

---

## Tech Stack

- **Frontend:** React, Vite, Recharts, WebSocket API
- **Backend / Orchestrator:** Python 3.11, FastAPI, Uvicorn, asyncio
- **Red Agent:** Stable-Baselines3 (PPO), custom Gym environment (`NetworkAttackEnv`)
- **Blue Agent:** XGBoost, scikit-learn (IsolationForest, SGDClassifier), joblib
- **Infrastructure:** Docker, Docker Compose (6 vulnerable service containers + orchestrator)
- **Vulnerable Services:** Flask (SQLi), Node.js (Path Traversal), Node.js (JWT Auth), PostgreSQL, Redis, Nginx
- **APIs / Services:** Docker SDK for Python (live log streaming), httpx (async HTTP attack execution)
- **Tools / Libraries:** NumPy, psycopg2, redis-py, MITRE ATT&CK framework (reference)

---

## Project Setup Instructions

### Prerequisites

- Docker & Docker Compose installed
- Python 3.11+ (for local dev / training)
- Node.js 18+ (for frontend dev server)

```bash
# Clone the repository
git clone <repo-link>
cd <repo-name>
```

### 0. Initialize Virtual Environment and install libraries

```bash
python -m venv venv

source venv/bin/activate

pip install -r requirements.txt
```

### 1. Train the Blue Agent models (one-time)

```bash
# From repo root — trains XGBoost + IsolationForest on domain-specific synthetic data
python -m agents.blue.train
```

### 2. Train the Red Agent (one-time)

```bash
# Trains the PPO attacker in the simulated environment
python -m agents.red.train
```

### 3. Start the battle cluster

```bash
# Builds all Docker containers (6 vulnerable services + orchestrator) and starts them
docker compose build && docker compose up
```

The orchestrator API will be available at `http://localhost:9000`.

### 4. Start the frontend dashboard

```bash
cd monitor/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 5. Run a battle

- Click **Start** in the dashboard to begin a round
- Watch Red execute the kill chain and Blue respond in real time
- Click **Stop** at any time, then **Start** again — Blue will pick up from where it left off (persistent learning)
- Click **Reset** to wipe Blue's memory and restart the arms race from scratch

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  React Dashboard                     │
│         (WebSocket — live event stream)              │
└───────────────────┬─────────────────────────────────┘
                    │ ws://localhost:9000/ws
┌───────────────────▼─────────────────────────────────┐
│              FastAPI Orchestrator                    │
│  ┌──────────────┐        ┌───────────────────────┐  │
│  │  Red Agent   │        │      Blue Team        │  │
│  │  (PPO/SB3)   │──────▶│  Detector + Responder │  │
│  │  NetworkEnv  │        │  XGBoost + IsoForest  │  │
│  └──────────────┘        │  SGD (online learning)│  │
└──────────────────────────┴────────────┬────────────┘
                                        │ Docker SDK
          ┌─────────────────────────────▼───────────────────┐
          │              Docker Network (172.28.0.0/24)      │
          │  flask-sqli │ node-path │ jwt-auth │ postgres │  │
          │  redis      │ nginx-misconfig                    │
          └───────────────────────────────────────────────────┘
```

---

## Team

| Name | Role |
|------|------|
| Red Agent | RL Engineering |
| Blue Agent | ML Engineering |
| Orchestrator | Backend |
| Frontend | Dashboard |
