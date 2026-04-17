# The Specter Sentinals-I01

# Problem Statement 
Karnataka has one of the largest livestock populations, but the "conception rate remains low (30–40%)" due to missed estrus (heat) detection. Farmers often fail to identify the critical "12–18 hour heat window", mainly because detection depends on manual observation and behavioral patterns vary due to climatic conditions (especially in Karnataka).

This leads to:
* Missed breeding opportunities
* Financial loss (₹3000–₹5000 per cycle per animal)
* Unnecessary veterinary visits
* Reduced dairy productivity

# Proposed Solution
We propose "PashuMitra", an AI-powered cattle monitoring system that combines "automatic video-based monitoring" and "manual analysis".
The system:
* Monitors cattle using video (CCTV / uploaded / YouTube simulation)
* Detects behaviors like mounting, restlessness, and movement
* Identifies cows using ear tag mapping
* Analyzes data using rule-based AI logic
* Generates real-time alerts for heat detection

Additionally, a "manual check-in system" allows veterinarians/farmers to:
* Select a cow
* Input symptoms
* Upload image/video
* Get an instant result (Heat / Monitor / Normal)

Uniqueness:
* Combines behavior detection + cow identification
* Works without real camera (video/YouTube support)
* Designed for rural usability
* Reduces manual effort and improves decision accuracy


# Features
* CCTV Monitoring (Automatic):
  Continuous video-based monitoring with simulated detection, tag recognition, and automatic alert generation.
* Manual Check-In System:
  Step-based workflow (Select cow → Symptoms → Media → Result) for manual analysis.
* Video & YouTube Support:
  Allows video upload or YouTube link for simulation instead of real camera.

* Cow Registration:
  Store cow details (ID, name, breed, age, ear tag ID) and map tags for identification.
* Behavior-Based Analysis:
  Detects mounting, movement, and restlessness to classify:
  * Heat (Red)
  * Monitor (Yellow)
  * Healthy (Green)
* Alerts & Dashboard:
  Real-time alerts and status updates displayed in dashboard.

# Tech Stack
* Frontend:
  React (Vite + TypeScript), Tailwind CSS
* Backend:
  FastAPI (Python)
* Database:
  SQLite
* AI / Logic:
  Rule-based simulation (future scope: MobileNetV2, XGBoost)
* Tools / Libraries:
  OpenCV (image/video processing), Zustand (state management), GitHub (version control)

 # Step to run project 
 1.Clone the Project
  *  git clone  https://github.com/saritanaik3022/hacktofuture4-I01
  * cd hacktofuture4-I01
2.Open terminal in project folder and run 
  * npm install
  * npm run dev)
3.open- http://localhost:5173/
