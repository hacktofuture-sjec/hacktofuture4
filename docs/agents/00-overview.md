# Agents Implementation — Phase 1 & 2 Complete ✅

## What Has Been Built

This document captures the complete Phase 1 & 2 implementation of the T3PS2 self-healing Kubernetes incident-response agent pipeline:

- **Phase 1**: Rule-based diagnosis (fingerprint catalog with 5 patterns) + policy-based planner (5 remediation policies)
- **Phase 2**: LLM fallback diagnosis layer with token budget governance + comprehensive test coverage

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  MONITOR AGENT → IncidentSnapshot (metrics, events, logs)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DIAGNOSE AGENT                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Stage 1: Rule-Based Fingerprint Matching (5 patterns)   │  │
│  │  - FP-001: Memory exhaustion (OOMKilled)                │  │
│  │  - FP-002: Crash loop (CrashLoopBackOff)               │  │
│  │  - FP-003: Image pull failure (ImagePullBackOff)       │  │
│  │  - FP-004: Infra saturation (FailedScheduling)         │  │
│  │  - FP-005: DB pool saturation (latency + timeout logs) │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Stage 2: Feature Extraction (13 features)               │  │
│  │  - Metrics: CPU%, Memory%, Restarts, Latency           │  │
│  │  - Signals: Z-scores, burst detection, event counts    │  │
│  │  - Logs: Top error signatures, event frequency         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Stage 3: LLM Fallback (if rule confidence < 75%)        │  │
│  │  - Robust JSON extraction with 3-tier fallback         │  │
│  │  - Token budget gates ($0.15/incident max)             │  │
│  │  - Graceful degradation on timeout/parse/connection    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                 ↓                                                │
│         DiagnosisPayload (root_cause, confidence, evidence)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      PLANNER AGENT                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Policy Ranking (5 policies ranked by risk)              │  │
│  │  - Policy 1: Restart pod (low risk)                     │  │
│  │  - Policy 2: Scale resources (low risk)                 │  │
│  │  - Policy 3: Rollback deployment (medium risk)          │  │
│  │  - Policy 4: Patch configuration (medium risk)          │  │
│  │  - Policy 5: Failover service (high risk)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Action Generation & Ranking                             │  │
│  │  - Template-based action commands                       │  │
│  │  - Context-aware parameter substitution                 │  │
│  │  - Risk-based ordering for human approval               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                 ↓                                                │
│         PlannerOutput (ranked actions with confidence/risk)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components & Files

| Component             | File                                     | Lines | Purpose                                                  |
| --------------------- | ---------------------------------------- | ----- | -------------------------------------------------------- |
| **Rule Engine**       | `backend/diagnosis/rule_engine.py`       | 180   | 5-pattern fingerprint catalog + matching logic           |
| **Feature Extractor** | `backend/diagnosis/feature_extractor.py` | 210   | 13-feature extraction (metrics, signals, logs)           |
| **LLM Fallback**      | `backend/diagnosis/llm_fallback.py`      | 280   | AI diagnosis with robust JSON parsing + error handling   |
| **Token Governor**    | `backend/governance/token_governor.py`   | 130   | Budget enforcement: max 2 calls/incident, $0.15/incident |
| **Policy Ranker**     | `backend/planner/policy_ranker.py`       | 150   | 5 policies ranked by risk + action templating            |
| **Data Contracts**    | `backend/models/schemas.py`              | 200+  | Pydantic models for all pipeline stages                  |
| **Enums**             | `backend/models/enums.py`                | 80+   | 9 enum classes (IncidentStatus, FailureClass, etc.)      |

---

## Key Design Decisions

### 1. Rule-First, AI-Fallback Strategy

- **Rule engine is primary path**: Fast, deterministic, fully explainable
- **LLM fallback is conditional**: Only triggered when rule confidence < 75%
- **Graceful degradation**: Timeouts, parse errors, and connection failures don't crash—fall back to rule-only results

### 2. Token Budget Enforcement

- **Hard limits**: Max 2 AI calls per incident, max $0.15 estimated cost per incident
- **Precision tracking**: Estimated cost (for gating) separate from actual cost (for audit)
- **Cost-aware rounding**: `estimate_cost()` returns unrounded value; rounding only on display/logging

### 3. Feature Extraction for Diagnosis

- **Z-score normalization**: Baseline-relative anomaly detection (CPU, memory, latency)
- **Burst detection**: Sudden spikes in restart count or error frequency
- **Top signatures**: Most common error messages + event reasons (e.g., "OOMKilled", "timeout")

### 4. Policy Ranking for Planner

- **Risk-based ordering**: Low-risk actions (restart) ranked first, high-risk actions (failover) last
- **Template-based actions**: Parameterized command templates with incident context substitution
- **Human approval gate**: All ranked actions sent to human for approval before execution

---

## Test Coverage

| Test Suite       | File                       | Count        | Coverage                                                 |
| ---------------- | -------------------------- | ------------ | -------------------------------------------------------- |
| Diagnosis Agents | `test_diagnosis_agents.py` | 9 tests      | All 5 fingerprints + matching logic                      |
| LLM Fallback     | `test_llm_fallback.py`     | 12 tests     | JSON parsing, error handling, graceful degradation       |
| Planner Agents   | `test_planner_agents.py`   | 11 tests     | Policy ranking, action generation, template substitution |
| Model Contracts  | `test_models_contract.py`  | 4 tests      | Pydantic schema validation                               |
| **Total**        | —                          | **37 tests** | **100% passing** ✅                                      |

---

## How to Read This Documentation

Build understanding in this order:

1. **[00-overview.md](00-overview.md)** ← You are here
2. **[01-phase1-diagnosis.md](01-phase1-diagnosis.md)** — Rule engine + 5 fingerprints
3. **[02-phase2-llm-fallback.md](02-phase2-llm-fallback.md)** — LLM fallback + graceful degradation
4. **[03-phase2-planner.md](03-phase2-planner.md)** — Policy ranking + action templating
5. **[04-token-governance.md](04-token-governance.md)** — Budget gating + cost tracking
6. **[05-data-contracts.md](05-data-contracts.md)** — All Pydantic models + field reference
7. **[06-testing-guide.md](06-testing-guide.md)** — How to run tests + interpret results
8. **[07-api-endpoints.md](07-api-endpoints.md)** — FastAPI endpoints + request/response contracts
9. **[08-running-the-system.md](08-running-the-system.md)** — Quick start + 5-minute demo

---

## Status & Next Steps

### ✅ Completed (Phase 1 & 2)

- Rule-based diagnosis with 5 fingerprints (FP-001 through FP-005)
- 13-feature extraction with Z-score + burst detection
- LLM fallback diagnosis with robust JSON parsing
- Token budget governance ($0.15/incident cap)
- 5-policy planner with risk-based ranking
- Comprehensive test suite (37/37 passing)
- Full Pydantic data contracts

### 🚧 Next: Phase 3 (Not yet started)

- Monitor Agent: Signal collection + 4-signal correlation
- Diagnose Agent Orchestration: Rule → AI fallback pipeline
- Planner Agent Orchestration: Policy selection + action recommendation
- Executor Agent: Apply approved remediation
- Monitor/Diagnose/Planner API endpoints

---

## File Structure

```
backend/
├── diagnosis/
│   ├── rule_engine.py          # 5-fingerprint catalog + matching
│   ├── feature_extractor.py    # 13 features (metrics, signals, logs)
│   └── llm_fallback.py         # AI diagnosis + JSON parsing + error handling
├── planner/
│   └── policy_ranker.py        # 5 policies + action generation + ranking
├── governance/
│   └── token_governor.py       # Token + cost budget enforcement
├── models/
│   ├── enums.py                # 9 enum classes
│   └── schemas.py              # 20+ Pydantic models
└── tests/
    ├── test_diagnosis_agents.py    # 9 fingerprint matching tests
    ├── test_llm_fallback.py        # 12 LLM + error handling tests
    ├── test_planner_agents.py      # 11 policy ranking tests
    └── test_models_contract.py     # 4 contract validation tests

docs/
└── agents/                      # THIS DOCUMENTATION
    ├── 00-overview.md
    ├── 01-phase1-diagnosis.md
    ├── 02-phase2-llm-fallback.md
    ├── 03-phase2-planner.md
    ├── 04-token-governance.md
    ├── 05-data-contracts.md
    ├── 06-testing-guide.md
    ├── 07-api-endpoints.md
    └── 08-running-the-system.md
```
