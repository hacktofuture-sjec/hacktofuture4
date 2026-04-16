# Trailblazers

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

Clearly describe the problem you are solving.

- What is the problem?
- Why is it important?
- Who are the target users?

---

## Proposed Solution

Explain your approach:

- What are you building?
- How does it solve the problem?
- What makes your solution unique?

---

## Features

List the core features of your project:

- Feature 1
- Feature 2
- Feature 3

---

## Tech Stack

Mention all technologies used:

- Frontend:
- Backend:
- Database:
- APIs / Services:
- Tools / Libraries:

---

## Project Setup Instructions

Provide clear steps to run your project:

```bash
# Clone the repository
git clone <repo-link>

# Install dependencies
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ..
flutter pub get

# Run backend
cd backend
python app.py

# Run Flutter app (web only)
cd ..
flutter run -d chrome
```

## Firebase Setup

This project is configured for web only.

1. Create a Firebase project in the Firebase console.
2. Add a Web app to your Firebase project.
3. Use the web config values in `lib/firebase_options.dart`.
4. Run the app with `flutter run -d chrome`.

If you later want Android or iOS support, add native Firebase config files separately.
