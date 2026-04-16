import os
import firebase_admin
from firebase_admin import credentials, firestore
from config import FIREBASE_KEY_PATH

_db = None
try:
    if os.path.exists(FIREBASE_KEY_PATH):
        cred = credentials.Certificate(FIREBASE_KEY_PATH)
        firebase_admin.initialize_app(cred)
        _db = firestore.client()
    else:
        raise FileNotFoundError(f"Firebase key file not found: {FIREBASE_KEY_PATH}")
except Exception as e:
    print(f"Firestore initialization skipped: {e}")


def store_event(data):
    if _db is not None:
        _db.collection("events").add(data)
    else:
        print("Skipping Firestore event storage, Firestore is not initialized.")

    
def get_baseline(session_id):
    if _db is None:
        print("Skipping baseline lookup, Firestore is not initialized.")
        return None

    docs = _db.collection("baselines").where("session_id", "==", session_id).stream()
    for doc in docs:
        return doc.to_dict()
    return None


def get_events():
    if _db is None:
        print("Skipping events fetch, Firestore is not initialized.")
        return []

    docs = _db.collection("events").stream()
    events = []
    for doc in docs:
        event = doc.to_dict()
        event['id'] = doc.id
        events.append(event)
    return events


def check_ip_reuse(session_id, ip):
    if _db is None:
        print("Skipping IP reuse check, Firestore is not initialized.")
        return False

    docs = _db.collection("events").where("session_id", "==", session_id).where("ip", "==", ip).stream()
    return len(list(docs)) > 0