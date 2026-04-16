<<<<<<< HEAD
SHECODES
=======
#SheCodes
# HackToFuture 4.0 — Template
>>>>>>> 76a8c92793877c61d8ad7cfa4401659e91cd5af8

# HackToFuture 4.0 — Decision-Driven Autonomous Recovery for Kubernetes Systems  

---

## Problem Statement / Idea

Modern cloud applications run on Kubernetes using multiple interconnected microservices. When something fails, Kubernetes can restart containers, but it does not understand the root cause of the problem.

Because of this:

* Failures can spread across services
* Systems can experience downtime quickly
* Engineers must manually analyze logs and metrics

This manual process is slow and does not scale well for large systems.

This problem mainly affects:

* Site Reliability Engineers (SREs)
* DevOps teams
* Developers managing cloud-native applications

---

## Proposed Solution

We built an Autonomous Recovery System that monitors system signals, detects issues, analyzes them, and suggests recovery actions.

### How it works:

1. Telemetry Collection
   The system collects signals such as CPU usage, memory usage, restart count, latency, and error rate.

2. Anomaly Detection
   A rule-based detection system checks if the signals cross defined thresholds.

3. AI-Based Analysis
   Gemini analyzes the detected anomaly and provides:

   * Root Cause
   * Recommended Action

4. Recovery Suggestion
   The system suggests actions like restarting a pod or scaling a deployment.

### What makes it different

Most systems only monitor and alert.
Our system helps in understanding the issue and suggests what action to take, reducing manual effort.

---

## Features

* Real-time telemetry collection
* Rule-based anomaly detection
* AI-based root cause analysis
* Recovery action suggestions
* Monitoring using Prometheus and Grafana
* Docker-based deployment

---

## Tech Stack

* Frontend: Streamlit
* Backend: FastAPI
* Monitoring: Prometheus
* Observability: OpenTelemetry
* Infrastructure: Docker
* Database: Redis
* AI: Gemini API

---

## Project Setup Instructions

```bash
# Clone the repository
git clone https://github.com/NehaRaii029/hacktofuture4-A08

# Go into the project folder
cd hacktofuture4-A08

# Run the project
docker-compose up -d --build
```

### Access the services

Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)
Grafana Dashboard: [http://localhost:3000](http://localhost:3000)
Prometheus: [http://localhost:9090](http://localhost:9090)

---

## Final Note

This project improves system reliability by turning monitoring data into clear insights and actionable recovery suggestions.
