# REKALL — Agentic CI/CD Failure Remediation System

REKALL is an intelligent, agent-driven system that automatically resolves CI/CD pipeline failures with governance, safety checks, and optional sandbox validation.

## What is REKALL?

REKALL is an Agentic CI/CD Orchestration Platform that monitors failing pipelines such as GitHub Actions, GitLab CI, and Jenkins, and performs the following:

* Detects failures in real time
* Diagnoses root causes using LLM-powered agents
* Retrieves or generates fixes
* Evaluates risk using governance scoring
* Decides whether to auto-apply, create a pull request, or wait for human approval
* Validates fixes in a sandbox before raising pull requests
* Learns from outcomes to improve future fixes

## Why REKALL?

CI/CD failures slow down development workflows and require significant manual debugging effort.

REKALL addresses this by automating debugging, learning from past incidents, enforcing safety through governance checks, validating fixes before submission, and providing real-time visibility through a dashboard.

## Architecture Overview

```
CI/CD Systems (GitHub / GitLab / Jenkins)
                │
                ▼
        Go Backend (Gin)
        - Webhooks
        - SSE Streaming
        - Incident Store
                │
                ▼
     Python Engine (FastAPI)
     - Agent Pipeline
     - LLM Reasoning
     - Fix Generation
                │
                ▼
         Vault (JSON)
     - Known fixes
     - Learned fixes
                │
                ▼
      Next.js Dashboard
     - Live agent timeline
     - Fix proposals
     - Approval flow
```

## Core Pipeline

REKALL executes a structured multi-agent pipeline:

1. MonitorAgent
   Normalizes raw CI/CD failure data

2. DiagnosticAgent
   Extracts root cause signals using recursive log analysis

3. FixAgent
   Retrieves or generates fixes using a three-tier system

   * T1 Human vault
   * T2 Learned fixes
   * T3 LLM-generated fixes

4. SimulationAgent
   Optional counterfactual validation

5. GovernanceAgent
   Computes a risk score and determines the action

6. PublishGuardAgent
   Detects unsafe or potentially harmful commands

7. Execution Layer
   Applies fixes or creates pull requests

8. LearningAgent
   Updates system knowledge based on outcomes

## Sandbox Validation

REKALL supports validation of fixes before raising pull requests using a Minikube sandbox environment.

* Creates an isolated Kubernetes environment
* Applies generated fixes
* Runs CI tests inside the sandbox
* Collects logs and results
* Creates a pull request only if tests pass

This ensures that proposed fixes are validated before human review.

## Tech Stack

| Layer     | Technology                    |
| --------- | ----------------------------- |
| Backend   | Go (Gin)                      |
| Engine    | Python (FastAPI, Groq)        |
| Frontend  | Next.js, TypeScript, Tailwind |
| AI Layer  | Groq LLaMA models             |
| Storage   | Flat-file JSON vault          |
| Streaming | Server-Sent Events            |
| Sandbox   | Minikube, Kubernetes, Valkey  |

## Features

* Real-time incident tracking
* Live agent timeline via SSE
* Intelligent fix generation
* Governance-based decision making
* Human approval workflow
* Self-learning vault system
* Sandbox-based validation
* Automated pull request creation
* Optional Slack and Notion integrations

## Getting Started

### Clone the repository

```bash
git clone https://github.com/your-username/rekall.git
cd rekall
```

### Setup environment

```bash
cp .env.example .env
```

Fill in required variables:

```
GROQ_API_KEY=your_key
GITHUB_TOKEN=your_token
GITHUB_REPO=owner/repo
```

### Run with Docker

```bash
make docker
```

Services will be available at:

* Backend: http://localhost:8000
* Engine: http://localhost:8002
* Frontend: http://localhost:3000

### Simulate failures

```bash
make simulate
```

Available scenarios:

* postgres_refused
* oom_kill
* test_failure
* secret_leak
* image_pull_backoff

## Dashboard

* /dashboard provides an overview of incidents
* /incidents/[id] shows a live agent execution timeline
* Includes vault explorer and metrics

## Vault System

REKALL uses a flat-file JSON vault to store and retrieve fixes.

* Stores known fixes
* Learns from successful outcomes
* Uses confidence scoring and reward signals
* Promotes generated fixes into reusable entries

## Governance Model

Risk-based decision system:

| Risk Score     | Action                 |
| -------------- | ---------------------- |
| less than 0.40 | Auto apply             |
| less than 0.70 | Create pull request    |
| 0.70 or higher | Block for human review |

Factors include confidence, failure type, use of secrets, and branch sensitivity.

## Safety

* Detects potentially dangerous commands
* Blocks unsafe automatic execution
* Requires human approval for high-risk fixes
* Uses sandbox validation as an additional safety layer
