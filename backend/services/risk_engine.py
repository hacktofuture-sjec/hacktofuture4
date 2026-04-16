from services.firestore_service import is_new_ip
from services.firestore_service import is_new_ip

def calculate_risk_score(ip, location=None, device=None, event=None, session_id=None, keystroke_interval=None, behavior_risk=None, interaction_data=None):
    score = 100

    from services.ip_service import get_location
    from services.frequency_service import check_request_frequency
    from services.firestore_service import is_new_ip   
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

    # NEW: integrate behavior risk
    if behavior_risk:
        score -= behavior_risk

    # NEW: Check for excessive UI interactions
    if interaction_data and isinstance(interaction_data, dict):
        if interaction_data.get('excessive_interaction', False):
            score -= 20  # Reduce score by 20 for excessive interactions

    # Check if IP has been used before for this session
    if is_new_ip(session_id, ip):
        score -= 40  # Flag as risky for IP reuse

    return max(score, 0)