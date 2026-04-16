import uuid
import requests
from flask import Blueprint, request, jsonify
from services.firestore_service import store_event, get_events
from services.ip_service import get_location

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

@session_bp.route('/session', methods=['POST'])
def handle_session():
    data = request.json or {}
    email = data.get("email")
    device = data.get("device", "unknown")
    event = data.get("event", "admin_login")
    keystroke_interval = data.get("keystroke_interval", 0)

    ip = resolve_client_ip()
    location = get_location(ip)

    session_id = str(uuid.uuid4())
    event_data = {
        "session_id": session_id,
        "email": email,
        "device": device,
        "event": event,
        "ip": ip,
        "location": location,
        "keystroke_interval": keystroke_interval,
    }

    store_event(event_data)
    return jsonify({"message": "Session stored", "session_id": session_id}), 200

@session_bp.route('/events', methods=['GET'])
def get_events_route():
    events = get_events()
    return jsonify(events)