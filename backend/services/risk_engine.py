from services.firestore_service import is_new_ip
from services.firestore_service import is_new_ip

def calculate_risk_score(ip, location=None, device=None, event=None, session_id=None, keystroke_interval=None):
    score = 100

    if not location:
        location = get_location(ip)
    if location != "India":
        score -= 30

    if "Android" not in str(device):
        score -= 10

    if event == "failed_login":
        score -= 20

    if check_request_frequency(session_id):
        score -= 30
    
    if keystroke_interval:
        if keystroke_interval < 50:
            score -= 25

    # Check if IP has been used before for this session
    if is_new_ip(session_id, ip):
        score -= 40  # Flag as risky for IP reuse

    return max(score, 0)