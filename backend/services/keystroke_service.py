from collections import defaultdict
import time
import statistics

# Store keystroke data per session
keystroke_buffer = defaultdict(list)

# Track last analysis time per session
last_analysis_time = defaultdict(lambda: 0)

# Cumulative behavior risk per session
cumulative_risk = defaultdict(int)

# Config
WINDOW_SIZE = 50      # number of keystrokes
TIME_WINDOW = 10      # seconds



def add_keystroke(session_id, dwell, flight):
    now = time.time()

    keystroke_buffer[session_id].append({
        "dwell": dwell,
        "flight": flight,
        "time": now
    })

    if should_analyze(session_id, now):
        return analyze_keystrokes(session_id)

    return None



def should_analyze(session_id, now):
    data = keystroke_buffer[session_id]

    # Condition 1: enough keystrokes
    if len(data) >= WINDOW_SIZE:
        return True

    # Condition 2: time exceeded
    if now - last_analysis_time[session_id] > TIME_WINDOW:
        return True

    return False


def analyze_keystrokes(session_id):
    data = keystroke_buffer[session_id]

    if len(data) < 5:
        return None  # not enough data

    dwell_times = [d["dwell"] for d in data]
    flight_times = [d["flight"] for d in data]

    avg_dwell = statistics.mean(dwell_times)
    avg_flight = statistics.mean(flight_times)

    behavior_risk = 0

    #  Basic anomaly rules (tune later)
    if avg_dwell > 200 or avg_dwell < 50:
        behavior_risk += 20

    if avg_flight > 200:
        behavior_risk += 15

    # Add to cumulative risk
    cumulative_risk[session_id] += behavior_risk

    # Reset buffer after analysis
    keystroke_buffer[session_id] = []
    last_analysis_time[session_id] = time.time()

    return {
        "avg_dwell": avg_dwell,
        "avg_flight": avg_flight,
        "behavior_risk": behavior_risk,
        "cumulative_risk": cumulative_risk[session_id]
    }