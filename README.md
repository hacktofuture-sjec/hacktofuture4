# Trailblazers

## Problem Statement / Idea

### What is the problem?

Most authentication systems today focus only on verifying a user at the time of login. Once the user successfully enters a password, OTP, or biometric detail, the system assumes that everything that happens afterward is safe and legitimate.

In reality, this is where many security risks begin. If someone gains access using stolen credentials or a hijacked session, they can continue operating inside the system without being detected. These actions are often subtle and designed to look like normal user behavior, making them difficult to identify using traditional methods.

---

### Why is it important?

The importance of this problem lies in how modern attacks are evolving. Not all threats are aggressive or immediate. Many of them are slow, silent, and spread over time, which makes them harder to detect and prevent.

For organizations that handle sensitive data, even a small unnoticed action can lead to serious consequences such as data leaks, financial loss, or misuse of internal systems. Detecting these threats early, especially while they are still subtle, is critical to maintaining security and trust.

---

### Who are the target users?

CyberSentinel is designed for small to mid-level enterprises that manage sensitive information and need stronger security without adding too much complexity to their systems.

These organizations may not experience frequent brute-force attacks, but they still face risks from session misuse, insider threats, or unauthorized access over time. The solution is built to provide them with a smarter and more continuous way of ensuring user authenticity.

---

## Proposed Solution

### What are you building?

We are building CyberSentinel, a system that continuously verifies user identity throughout an active session instead of relying only on a one-time login check.

The system observes user behavior in the background and evaluates whether the current activity matches the expected behavior of the authenticated user.

---

### How does it solve the problem?

CyberSentinel works by monitoring behavioral and contextual signals such as IP address, location, and keystroke patterns during the session. Instead of making a one-time decision, it keeps updating a trust score as the user interacts with the system.

If the system detects unusual patterns or deviations, it responds gradually. It may start with simple monitoring, then move to restrictions, and finally trigger re-authentication or session termination if the risk becomes high.

This approach allows the system to detect both immediate and slow-developing threats without interrupting normal users unnecessarily.

---

### What makes your solution unique?

What makes CyberSentinel different is its focus on continuous and adaptive verification rather than one-time authentication.

It is designed to detect subtle and long-term anomalies that traditional systems usually miss. Instead of reacting only to obvious threats, it quietly builds an understanding of normal user behavior and identifies deviations over time.

The system also avoids being overly aggressive. It balances security and usability by responding proportionally to the level of risk, ensuring that genuine users are not disrupted unnecessarily.

---

## Features

Continuous Behavioral Monitoring
- Performs real-time threat surveillance across IP, location, and keystroke dynamics
- Tracks IP anomalies, unauthorized networks, and proxy usage
- Detects geolocation shifts, impossible travel, and geo-spoofing
- Profiles keystroke dwell time and flight time as behavioral biometrics
- Any deviation from the established behavioral baseline immediately triggers a trust score recalculation

Adaptive Security Response
- Upon detection of anomalous activity, the system issues real-time popup alerts as the first line of defense
- Response scales with risk severity:
  - Low risk — passive surveillance and audit logging
  - Medium risk — multi-factor re-authentication challenge via OTP
  - High risk — forced session invalidation and termination

Device Intelligence and Session Integrity
- Establishes a trusted device profile at session initialization by:
- Continuously validates device consistency throughout the session
- Flags any mid-session anomalies as potential session hijacking attempts
- Provides real-time visibility into active sessions, risk scores, and anomalies through the admin dashboard

## Tech Stack

*Frontend:*  
Flutter (Web)

*Backend:*  
Flask / FastAPI (Python)

*Database:*  
Firebase Firestore  

*APIs / Services:*  
IP Geolocation API  
ipfy
Firebase Authentication  

*Tools / Libraries:*  
Requests  
Flask-CORS  

---

## Setup

### Clone the repository

bash
git clone <repo-link>
cd <project-folder>


# Install dependencies
# Backend

bash
cd backend
pip install -r requirements.txt
python app.py


# Frontend
bash
cd ..
flutter pub get


To Run Frontend Application:
Run Admin Dashboard (Main Panel)
Run this in the same terminal:

bash
flutter run -d chrome

Run User Dashboard (Separate Window)
Open a new terminal and run:
bash
cd <project-folder>
flutter run -d chrome

(This setup allows you to run both admin and user dashboards simultaneously.)


