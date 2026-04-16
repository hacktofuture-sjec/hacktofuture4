import uuid
import requests
from flask import Blueprint, request, jsonify
from services.firestore_service import store_event, get_events
from services.ip_service import get_location
from services.keystroke_service import add_keystroke
from services.risk_engine import calculate_risk_score  # ✅ NEW

session_bp = Blueprint('session', __name__)

def get_public_ip():
    try:
        response = requests.get("https://api.ipify.org?format=json", timeout=5)
        if response.status_code == 200:
            return response.json().get("ip")
    except Exception:
        return None

def resolve_client_ip():
    x_forwarded_for = request.headers.get("X-Forwarded-For", "")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.remote_addr

    if ip in ("127.0.0.1", "::1", "localhost", None):
        ip = get_public_ip() or ip

    return ip or "unknown"

def is_dummy_event(email, event):
    if not email or not str(email).strip():
        return event != 'admin_login'
    normalized = str(email).strip().lower()
    return normalized == 'unknown'


@session_bp.route('/session', methods=['POST'])
def handle_session():
    data = request.json or {}
    email = data.get("email")
    device = data.get("device", "unknown")
    event = data.get("event", "admin_login")
    dwell = data.get("dwell")
    flight = data.get("flight")
    interaction_data = data.get("interaction_data")  # NEW: Get interaction data

    ip = resolve_client_ip()
    location = get_location(ip)

    if is_dummy_event(email, event):
        return jsonify({"message": "Ignored anonymous/dummy event"}), 204

    if not email:
        email = 'ADMIN' if event == 'admin_login' else 'Unknown'

    session_id = str(uuid.uuid4())

    keystroke_result = None
    if dwell is not None and flight is not None:
        keystroke_result = add_keystroke(session_id, dwell, flight)

    # ✅ NEW: calculate risk with interaction data
    risk_score = calculate_risk_score(
        ip=ip,
        location=location,
        device=device,
        event=event,
        session_id=session_id,
        behavior_risk=keystroke_result["behavior_risk"] if keystroke_result else 0,
        interaction_data=interaction_data  # NEW: Pass interaction data
    )

    event_data = {
        "session_id": session_id,
        "email": email,
        "device": device,
        "event": event,
        "ip": ip,
        "location": location,
        "trust_score": risk_score,  # ✅ NEW
    }

    if keystroke_result:
        event_data["behavior_risk"] = keystroke_result["behavior_risk"]
        event_data["cumulative_risk"] = keystroke_result["cumulative_risk"]

    # NEW: Store interaction data if present
    if interaction_data:
        event_data["interaction_data"] = interaction_data

    store_event(event_data)
    return jsonify({"message": "Session stored", "session_id": session_id}), 200

@session_bp.route('/events', methods=['GET'])
def get_events_route():
    try:
        events = get_events()
        filtered = [e for e in events if e.get('email') and str(e.get('email')).strip().lower() != 'unknown']
        return jsonify(filtered)
    except Exception as e:
        print("Error in /events route:", e)
        return jsonify([]), 200