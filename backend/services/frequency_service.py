from collections import defaultdict
import time

request_log = defaultdict(list)

def check_request_frequency(session_id):
    now = time.time()

    request_log[session_id] = [
        t for t in request_log[session_id] if now - t < 60
    ]

    request_log[session_id].append(now)

    return len(request_log[session_id]) > 5