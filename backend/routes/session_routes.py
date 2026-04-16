from flask import Blueprint, request, jsonify
from services.risk_engine import calculate_risk_score
from services.firestore_service import store_event, get_events

session_bp = Blueprint('session', __name__)

@session_bp.route('/analyze', methods=['POST'])
def analyze():
    print("ANALYZE ENDPOINT HIT")
    data = request.json

    # Extract fields
    # Get real IP from request
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    # Optional: if behind proxy, take first IP
    if ip and ',' in ip:
        ip = ip.split(',')[0].strip()
    print("IP:", ip)
    location = data.get("location")
    device = data.get("device")
    event = data.get("event")
    session_id = data.get("session_id")
    keystroke_interval = data.get("keystroke_interval")

    # Basic validation (IMPORTANT)
    if not ip or not session_id:
        return jsonify({"error": "Invalid input"}), 400

    # Calculate risk
    score = calculate_risk_score(
        ip, location, device, event, session_id, keystroke_interval
    )

    # Decide action
    if score < 40:
        action = "BLOCK"
    elif score < 60:
        action = "2FA"
    else:
        action = "ALLOW"

    # ✅ ADD THIS (CRITICAL FIX)
    data['trust_score'] = score
    data['action'] = action
    data['ip'] = ip
    print("DATA STORED:", data)

    # Store event WITH score
    store_event(data)

    return jsonify({
        "trust_score": score,
        "action": action
    })


@session_bp.route('/events', methods=['GET'])
def get_events_route():
    events = get_events()
    return jsonify(events)