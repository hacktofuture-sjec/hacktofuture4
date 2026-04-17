# BlueBerry

Welcome to your official HackToFuture 4 repository.

This repository template will be used for development, tracking progress, and final submission of your project. Ensure that all work is committed here within the allowed hackathon duration.

---

### Instructions for the teams:

- Fork the Repository and name the forked repo in this convention: hacktofuture4-team_id (for eg: hacktofuture4-A01)

---

## Rules

- Work must be done ONLY in the forked repository
- Only Four Contributors are allowed.
- After 36 hours, Please make PR to the Main Repository. A Form will be sent to fill the required information.
- Do not copy code from other teams
- All commits must be from individual GitHub accounts
- Please provide meaningful commits for tracking.
- Do not share your repository with other teams
- Final submission must be pushed before the deadline
- Any violation may lead to disqualification

---

# The Final README Template 


## Problem Statement / Idea

- **What is the problem?**  
  Millions of small businesses (restaurants, salons, local shops) either have no online presence or a weak one. Their Google listings are incomplete, they lack websites, and they are often invisible to potential customers searching online.

- **Why is it important?**  
  In today’s digital-first world, poor online presence directly translates to lost revenue. Small business owners typically lack the time, technical knowledge, or resources to build and maintain a strong digital footprint.

- **Who are the target users?**  
  - Local small business owners (restaurants, salons, gyms, repair shops)  
  - Businesses with weak or no online presence  
  - Non-technical owners who want simple, managed digital solutions  

---

## Proposed Solution

- **What are you building?**  
  Vector++ is an automated platform that identifies businesses with poor online presence, generates ready-to-use websites for them, and continuously improves those websites based on customer feedback.

- **How does it solve the problem?**  
  - Discovers businesses lacking digital presence using data sources like Google Maps  
  - Automatically generates a complete website preview using templates and AI-generated content  
  - Allows instant demonstration of value before any sales interaction  
  - Continuously monitors customer feedback (reviews, interactions) and improves the website automatically  

- **What makes your solution unique?**  
  - Pre-built website previews before pitching (value-first approach)  
  - Fully automated feedback-to-improvement loop  
  - Subscription-based continuous optimization instead of one-time delivery  
  - Combines scraping, AI generation, and autonomous updates into one system  

---

## Features

- Automated business discovery and opportunity scoring  
- Instant website generation using AI and pre-built templates  
- Multi-solution improvement engine for continuous optimization  
- Customer feedback ingestion and clustering  
- Automatic website updates based on real user feedback  
- CRM system for managing outreach and conversions  

---

## Tech Stack

- **Frontend:** React.js, Tailwind CSS  
- **Backend:** Python (FastAPI) / Node.js  
- **Database:** Supabase (PostgreSQL)  

### APIs / Services
- Google Maps data sources  
- LLM APIs (OpenAI / Anthropic / Ollama)  
- Hosting platforms (Vercel / Netlify)  

### Tools / Libraries
- sentence-transformers (for embeddings)  
- DBSCAN (for clustering feedback)  
- Playwright (for scraping)  
- Docker (for sandbox/testing)  

---

## Project Setup Instructions

```bash
# Clone the repository
git clone <repo-link>

# Navigate into the project
cd vector-plus-plus

# Install dependencies (backend)
pip install -r requirements.txt

# Install dependencies (frontend)
cd frontend
npm install

# Run backend server
cd ..
uvicorn main:app --reload

# Run frontend
cd frontend
npm run dev
...
```
