# TEAM DOLLAR$IGN (C06)


## Problem Statement :T2PS1




### Project Analysis: Aegis-DID

## What is the Problem?

Traditional authentication mechanisms (such as passwords or Single Sign-On) are designed to verify identity only at the initial point of login
. This creates a significant security gap for autonomous AI agents that maintain persistent, long-running sessions
. If an agent's token is stolen or its intent is hijacked via prompt injection during a session, attackers can achieve unrestricted lateral movement across a network at machine speed
. Furthermore, Non-Human Identities (NHIs) now outnumber human identities by a ratio of 50:1, making NHI exploitation the top cybersecurity threat in modern enterprises


 ## Why is it important?

* **This project is critical because it moves beyond static security to a proactive, self-healing defense**
* **Its importance is highlighted by several key factors :**

* **Credential Security:** It reduces the window of exposure for stolen credentials by 75% through the use of ephemeral, short-lived identities

* **Regulatory Compliance:** It directly implements requirements for the Cloud Security Alliance's (CSA) new Agentic Trust Framework (ATF), providing a standard for governing non-human actors

* **Scalability:** By using a decentralized authentication model, it allows millions of machine-to-machine interactions to scale without creating a bottleneck at a central Identity Provider (IdP)

* **System Integrity:**
It ensures that the safety of enterprise systems depends on rigorous monitoring and autonomous containment rather than just the "intelligence" of the AI itself


 ## Who are the target users?

 * **Enterprises using Autonomous AI:** Organizations that deploy AI agents to handle sensitive data or interact with internal APIs and databases

 * **Cloud & Infrastructure Teams:** Users operating in Kubernetes and Docker environments who need to securely scope and manage machine identities

 * **Cybersecurity & Compliance Officers:** Professionals who must ensure their AI deployments align with emerging standards like the CSA’s Agentic Trust Framework

 * **Developers of Agentic AI:** Those building the next generation of autonomous intelligence who require a decentralized infrastructure to safely scale their applications
---

### Proposed Solution



## What are we building?

I am building Aegis-DID (Agentic Ephemeral Governance & Identity System), a decentralized Zero Trust architecture specifically designed for the era of autonomous AI agents

* This system is a closed-loop security framework that integrates cryptographic identity (using SPIFFE/SPIRE), kernel-level observability (via eBPF), and AI-driven analytics (using Neo4j and PyTorch) to manage and secure non-human identities

 * It is designed to run in modern orchestration environments like Kubernetes and Docker, ensuring that every AI workload has a verified, verifiable, and temporary identity

### How does it solve the problem?

* **Traditional security models fail because they only verify an identity at the initial login, which is insufficient for AI agents that maintain long, persistent sessions**

* **Aegis-DID solves this by shifting to a continuous identity verification model**

* **Eliminating Static Risk:** Instead of using permanent API keys, the system issues highly ephemeral cryptographic identity documents (SVIDs) that expire in minutes or seconds, reducing the time a stolen credential can be used by 75%

* **Monitoring Behavioral Intent:** While the agent is active, the system uses eBPF and OpenTelemetry to capture real-time telemetry

* **A causal inference engine then analyzes this data to detect "intent drift"—signs that an agent’s behavior has been hijacked, perhaps through a prompt injection attack**

* **Autonomous Containment:** If the system detects suspicious behavior, the agent’s Trust Score drops

* **This immediately triggers the Open Policy Agent (OPA) to autonomously strip the agent of its permissions or use Kubernetes NetworkPolicies to physically isolate the compromised pod, "self-healing" the perimeter at machine speed**

 ## What makes your solution unique?
* **Our approach is unique because it moves beyond simple authentication to dynamic, behavior-gated governance**

* **Zero-Instrumentation Monitoring:** By using eBPF, we can monitor an agent's activities at the kernel level without needing to modify the agent's code or adding any performance latency

* **Decentralized Scalability:** Unlike traditional systems that rely on a central Identity Provider (IdP) which can become a bottleneck, our decentralized architecture allows millions of machine-to-machine interactions to scale efficiently

* **Causal Behavioral Mapping:** We utilize Neo4j to construct StateGraphs of agent behavior, allowing us to compare real-time actions against historical baselines using advanced causal inference, which is more sophisticated than simple rule-based security

* **Regulatory Alignment:**  Aegis-DID is one of the first systems to directly implement the requirements of the Cloud Security Alliance’s (CSA) Agentic Trust Framework (ATF), providing a ready-made path for enterprises to meet new safety standards for non-human actors

---

## Features

# 🛡️ Aegis-DID: Core Features

### 1. Decentralized Identity Plane (DID-Layer)
Aegis-DID eliminates the "Point-of-Failure" bottleneck of centralized Identity Providers (IdPs) by leveraging self-sovereign identity standards.
* **W3C-Compliant DIDs & VCs:** Assigns unique Decentralized Identifiers and Verifiable Credentials to every agent, providing an immutable cryptographic anchor.
* **Local Public-Key Verification:** Enables microservices to authenticate agents at the edge without querying a central server, reducing latency by **50%**.
* **Hardware Root of Trust:** Integrates with **SPIFFE/SPIRE** to bind identities to specific Kubernetes workloads and hardware signatures.

### 2. Behavioral Biometrics & Causal Inference
Security that monitors what an agent *does*, not just what it *shows*.
* **eBPF-Powered Telemetry:** Uses Extended Berkeley Packet Filter technology for zero-instrumentation monitoring of kernel-level API calls and network traffic.
* **Causal Discovery Engine:** Employs **Neural Granger Causality** to build dynamic StateGraphs of agent behavior. It distinguishes between complex reasoning and malicious "Confused Deputy" attacks or prompt injections.
* **Real-time Trust Scoring ($T_{a,t}$):** A continuous, mathematically derived score that fluctuates based on behavioral alignment with the agent’s historical MetaGraph.

### 3. Adaptive Ephemeral Governance
Aegis-DID transitions security from binary "Allow/Deny" to a fluid, risk-adjusted posture.
* **Dynamic Token TTL:** Access tokens feature a non-linear Time-to-Live. As an agent's Trust Score drops, its token lifespan aggressively shrinks (e.g., from 60s to 5s), forcing high-frequency re-authentication.
* **MCP Scoping & ABAC:** Native integration with the **Model Context Protocol (MCP)**. It dynamically strips write permissions or restricts tool access via Attribute-Based Access Control if the agent's intent becomes ambiguous.

### 4. Autonomous Containment & Self-Healing
Immediate, machine-speed response to identity compromise.
* **Automated Pod Isolation:** Automatically triggers Kubernetes **NetworkPolicies** to "Default-Deny" the moment a trust threshold is breached, preventing lateral movement.
* **Global Revocation Broadcast:** Instantly invalidates VCs across the entire distributed ledger, terminating all active sessions globally.
* **Immutable Forensic Snapshots:** Captures the final memory state, prompt history, and execution trace of quarantined agents for cryptographically signed audit trails.

---

## Tech Stack

### Frontend

- React 19
- Vite
- Tailwind CSS
- Recharts
- Lucide React

### Backend and AI Services

- Python 3.11
- FastAPI (analytics API)
- Uvicorn
- Sentence Transformers (all-MiniLM-L6-v2)
- PyTorch

### Identity and Security

- SPIFFE/SPIRE (workload identity)
- eBPF observability via Cilium Tetragon
- OPA-style policy enforcement flow in the demo narrative

### Observability and Logging

- Fluent Bit
- Parseable
- Grafana

### DevOps and Runtime

- Docker
- Docker Compose
- Node.js and npm

---

## Project Setup Instructions

### Prerequisites

Install the following before running the project:

- Docker Desktop (with Docker Compose)
- Node.js 20+ and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/priyanshu5ingh/hacktofuture4-C06.git
cd hacktofuture4-C06
```

### 2. Start backend and infrastructure services

From the project root, run:

```bash
docker compose up -d --build
```

Before starting the stack, set these environment variables in a local `.env` file or your shell:

- `SPIRE_JOIN_TOKEN`
- `PARSEABLE_USERNAME`
- `PARSEABLE_PASSWORD`
- `PARSEABLE_BASIC_AUTH`
- `GRAFANA_ADMIN_PASSWORD`
- `FRONTEND_ORIGINS` (optional, defaults to `http://localhost:5173`)

This brings up:

- analytics-engine on port 8000
- parseable on port 8081
- grafana on port 3000
- spire-server, spire-agent, mock-agent, tetragon, fluent-bit

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at:

- http://localhost:5173

### 4. Useful service URLs

- Frontend: http://localhost:5173
- Analytics API docs: http://localhost:8000/docs
- Grafana: http://localhost:3000/login (default credentials: admin / admin)
- Parseable: http://localhost:8081

### 5. Verify containers are healthy

From the project root:

```bash
docker compose ps -a
```

### 6. Stop the stack

```bash
docker compose down
```








