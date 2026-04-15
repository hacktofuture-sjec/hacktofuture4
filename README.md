# 🚀 PipelineMedic  
### Self-Learning AI DevOps Agent for CI/CD Failure Diagnosis and Auto-Healing

---

## 🧩 Problem Statement / Idea

### What is the problem?
Modern CI/CD pipelines frequently fail due to dependency issues, configuration errors, missing environment variables, and failing tests. Developers must manually inspect logs and debug issues, which is time-consuming and repetitive.

### Why is it important?
- Debugging CI/CD failures takes **30–60 minutes per issue**
- Slows down development and deployment cycles  
- Requires experienced DevOps knowledge  
- Increases operational overhead  

### Who are the target users?
- Software Developers  
- DevOps Engineers  
- Site Reliability Engineers (SREs)  
- Engineering teams using CI/CD pipelines  

---

## 💡 Proposed Solution

### What are we building?
PipelineMedic is an **AI-powered DevOps agent** that automatically detects CI/CD failures, analyzes logs, generates fixes, and creates pull requests.

### How does it solve the problem?
- Detects pipeline failures via GitHub Webhooks  
- Fetches logs and analyzes them using AI (Llama3 / Mixtral)  
- Identifies root cause and generates fix  
- Creates pull request automatically  
- Re-runs pipeline to validate fix  

### What makes it unique?

🔥 **Self-Learning Failure Memory**
- Stores past failures and fixes  
- Reuses solutions instantly  

⚡ **Auto-Heal Mode**
- Automatically resolves repeated failures  

🧠 **Confidence Scoring**
- Determines reliability of fixes  

🛡️ **Risk-Based Automation**
- Ensures safe deployment decisions  

---

## ⚙️ Features

- 🔍 Automatic CI/CD failure detection  
- 🧠 AI-based log analysis and root cause detection  
- 🔧 Automated fix generation  
- 🔁 Pull request creation  
- ♻️ Self-learning failure memory *(unique)*  
- ⚡ Auto-heal for repeated issues *(unique)*  
- 📊 Confidence scoring  
- 🛡️ Risk-based governance  

---

## 🧰 Tech Stack

### Frontend
- (Optional) React / Next.js  

### Backend
- Python  
- FastAPI  

### Database
- SQLite / JSON  

### APIs / Services
- Groq API (Llama3 / Mixtral)  
- GitHub REST API  
- GitHub Webhooks  

### Tools / Libraries
- Uvicorn  
- Requests  
- Ngrok (for webhook testing)  

---

## ⚡ Project Setup Instructions

### 1. Clone the repository

```bash
git clone <repo-link>
cd pipeline-medic
