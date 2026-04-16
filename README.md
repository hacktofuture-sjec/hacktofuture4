<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="50" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="50" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TensorFlow-Dark.svg" width="50" />
  <h1 style="color: #34d399; font-weight: bold; margin-top: 15px;">🌐 NeuroMesh</h1>
  <p><b>AI-Powered Disaster Response & Telemetry Validation Network</b></p>
  
  [![HackToFuture 4](https://img.shields.io/badge/HackToFuture-4-blueviolet?style=for-the-badge)](#)
  [![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)](#)
</div>

<br/>

## 🚨 Problem Statement / Idea

**What is the problem?**
During critical disasters (earthquakes, structural collapses, gas leaks), first responders are blinded by chaotic data, broken communication lines, and false alarms. Misallocating rescue teams to a "false alarm" while a real crisis unfolds costs lives.

**Why is it important?**
The "Golden Day" (first 24 hours) is crucial for survival. Emergency response systems need filtered, validated, and highly accurate situation reports (SitReps) to deploy Urban Search and Rescue (USAR) teams safely and dynamically.

**Who are the target users?**
- National Disaster Response Force (NDRF) / FEMA
- Emergency Command Centers
- First Responders & Hazmat (CBRN) Teams

---

## 💡 Proposed Solution

**What are we building?**
**NeuroMesh** is a comprehensive hardware-software simulation platform representing a deployed mesh network of environmental sensors. It feeds raw telemetry (seismic vibrations, gas PPM, PIR survivor movement) into a multi-stage AI pipeline. 

**How does it solve the problem?**
Raw data is processed by specialized ML models (CNNs for seismic, Random Forests for gas). Crucially, an **Isolation Forest** validator checks the aggregated outputs to flag hardware glitches or false alarms. If authenticated, an LLM (Mistral) generates an actionable, military-grade Situation Report (SitRep).

**What makes your solution unique?**
- **False Alarm Filtration:** We don't just alert; we authenticate the crisis using anomaly detection, saving wasted rescue trips.
- **Multi-Modal AI:** Specialized models handle specific sensor outputs before fusing data into LangGraph.
- **Interactive UI:** A Next.js Turbopack dashboard visualizes node status with real-time Framer Motion animations.

---

## 🚀 Features

- 🟢 **Live Telemetry Dashboard:** An interactive Web GIS UI plotting mesh nodes and live status.
- 🧠 **Multi-Model Inference:** 
  - Seismic Activity Classification (Keras/TensorFlow)
  - Hazardous Gas Prediction (Scikit-Learn Random Forest)
  - Survivor Count Estimation (Scikit-Learn)
- 🛡️ **Crisis Validator (Isolation Forest):** Identifies erratic sensor behavior or false positives.
- ⚡ **Automated LLM SitReps:** LangGraph orchestration to output clear "Recommended Actions" and "Threat Levels".
- 📡 **Simulated LoRaWAN Network:** Fallback communication visualization for unconnected zones.

---

## 🛠️ Tech Stack

<details>
<summary><b>Click to expand technical details</b></summary>
<br/>

- **Frontend:** Next.js 16 (App Router, Turbopack), React, TailwindCSS, Framer Motion, Lucide Icons
- **Backend / AI Pipeline:** Python 3.13, LangGraph
- **Machine Learning:** Scikit-Learn, TensorFlow/Keras, Pandas, NumPy
- **Generative AI:** Mistral / LLM (SitRep Generation)
- **Data:** CSV-based robust simulated environments (`gas_data.csv`, `seismic_data.csv`, `survivor_data.csv`)

</details>

---

## ⚙️ Project Setup Instructions

Provide clear steps to run your project:

```bash
# 1. Clone the repository
git clone https://github.com/haashid/hacktofuture4-I03.git
cd hacktofuture4-I03

# ---------------------------------------------
# FRONTEND (Next.js Dashboard)
# ---------------------------------------------
cd dashboard
npm install

# Run the Next.js development server
npm run dev

# ---------------------------------------------
# AI PIPELINE (Python Environment)
# ---------------------------------------------
# Open a new terminal and navigate to the project root
cd ..

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install AI dependencies
pip install scikit-learn tensorflow pandas numpy langgraph

# Run the AI Pipeline 
python pipeline/langgraph_pipeline.py
```

<br/>
<div align="center">
  <sub>Built with ❤️ for HackToFuture 4</sub>
</div>