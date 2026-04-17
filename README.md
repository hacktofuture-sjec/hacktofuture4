# JanSetu: AI-Powered Smart City Complaint Analysis & Automation System

JanSetu is a next-generation civic governance platform designed to bridge the gap between citizens and government authorities using Artificial Intelligence, Real-time Mapping, and Multi-channel Communication (WhatsApp + Web).


## 🚀 Key Features

### 1. Multi-Channel Reporting
*   **WhatsApp Chatbot**: Direct reporting via WhatsApp. Supports stateful conversations, intent detection, and native **GPS Location Pin** sharing.
*   **Web Portal**: A high-fidelity React dashboard for citizens to report issues with images and geolocation.

### 2. JanSetu AI Brain (Powered by Groq)
*   **Automatic Categorization**: AI identifies if a report belongs to Water Supply, Electricity, Public Works, etc.
*   **Severity Analysis**: Determines the urgency of every case based on semantic context (e.g., "Live wire" = High Priority).
*   **Semantic Clustering**: Uses TF-IDF Vectorization to group similar reports, identifying city-wide **Hotspots** automatically.

### 3. Executive Command Center
*   **Overwatch Map**: Real-time visual heatmaps of civic issues using `react-leaflet`.
*   **Departmental Dashboards**: Authority-specific feeds that prioritize the most urgent cases first.
*   **Analytics Engine**: Instant reporting of load distribution across city departments.

### 4. Smart Notifications & Escalation
*   **Direct Alerts**: Automated emails to department heads when new critical issues are assigned.
*   **Escalation Protocols**: If an issue isn't resolved within its SLA deadline, it is automatically escalated and flagged in the Executive Insight view.

---

## 🛠️ Technology Stack

*   **Frontend**: React.js, TailwindCSS, Framer Motion, Lucide Icons.
*   **Backend**: Node.js, Express.
*   **Database**: MongoDB (Atlas/Local).
*   **AI/LLM**: Groq Cloud (Llama 3 8B/70B).
*   **Communications**: Twilio WhatsApp API, Nodemailer.
*   **Mapping**: Leaflet, OpenStreetMap (Nominatim Geocoding).

---

## 📥 Setup Instructions

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB installed locally or a MongoDB Atlas URI.
*   Groq API Key (get it [here](https://console.groq.com/)).
*   Twilio Account (for WhatsApp integration).

### 2. Environment Configuration
Create a `.env` file in the `server` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/jansetu
GROQ_API_KEY=your_groq_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_NUMBER=whatsapp:+14155238886

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 3. Installation

**For Backend:**
```bash
cd server
npm install
npm run dev
```

**For Frontend:**
```bash
cd client
npm install
npm run dev
```

---

## 📱 WhatsApp Integration Settings

To test WhatsApp reporting:
1.  **Start Ngrok**: `ngrok http 5000`
2.  **Twilio Sandbox**: Go to Twilio Messaging Settings -> WhatsApp Sandbox.
3.  **Webhook URL**: Set the "When a message comes in" URL to `https://your-ngrok-url.ngrok.io/api/whatsapp`.
4.  **Try it**: Send a status query like *"Total number of complaints"* or a report like *"Report a water leak at MGM Hospital"* followed by your location pin.

---

## 🏛️ Project Structure

```text
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI (Navbar, Map, Chatbot)
│   │   ├── pages/           # Strategic Views (Landing, Dashboards, Rewards)
│   │   └── context/         # Auth & Global State
├── server/
│   ├── models/              # Mongoose Schemas (Complaint, User)
│   ├── routes/              # APIs (Auth, Complaints, WhatsApp, Analytics)
│   ├── services/            # Logic (AI Brain, Clustering, Notifications)
│   └── controllers/         # Request Handlers
```

## 📜 License
This project was developed for the **HackToFuture** hackathon. All rights reserved.

---
**Build a smarter city, one report at a time.** 🌍✨
