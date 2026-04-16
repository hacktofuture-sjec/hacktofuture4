from flask import Blueprint, request, jsonify
from services.risk_engine import calculate_risk_score
from services.firestore_service import store_event, get_events, check_ip_reuse

session_bp = Blueprint('session', __name__)

@session_bp.route('/analyze', methods=['POST'])
def analyze():
    data = request.json

    ip = data.get("ip")
    location = data.get("location")
    device = data.get("device")
    event = data.get("event")
    session_id = data.get("session_id")
    keystroke_interval = data.get("keystroke_interval")

    # Store event in Firestore
    store_event(data)

    # Calculate risk
    score = calculate_risk_score(ip, location, device, event, session_id, keystroke_interval)

    # Decide action
    if score < 40:
        action = "BLOCK"
    elif score < 60:
        action = "2FA"
    else:
        action = "ALLOW"

    return jsonify({
        "trust_score": score,
        "action": action
    })

@session_bp.route('/events', methods=['GET'])
def get_events_route():
    events = get_events()
    return jsonify(events)