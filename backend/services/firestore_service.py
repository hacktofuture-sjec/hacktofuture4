import json
import os
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore
from config import FIREBASE_KEY_PATH

_db = None
FALLBACK_EVENTS_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'events_fallback.json')
)
fallback_events = []


def _load_fallback_events():
    global fallback_events
    if os.path.exists(FALLBACK_EVENTS_FILE):
        try:
            with open(FALLBACK_EVENTS_FILE, 'r', encoding='utf-8') as f:
                fallback_events = json.load(f)
            print(f'Loaded {len(fallback_events)} fallback events from {FALLBACK_EVENTS_FILE}')
        except Exception as e:
            print('Failed to load fallback event file:', e)
            fallback_events = []
    else:
        fallback_events = []


def _save_fallback_events():
    try:
        with open(FALLBACK_EVENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(fallback_events, f, indent=2, default=str)
    except Exception as e:
        print('Failed to save fallback event file:', e)


def _store_fallback_event(data):
    if 'created_at' not in data:
        data['created_at'] = datetime.utcnow().isoformat() + 'Z'
    data['trust_score'] = data.get('trust_score', 0)
    data['action'] = data.get('action', data.get('event', 'UNKNOWN'))
    data['id'] = data.get('id', f'fallback_{len(fallback_events) + 1}')
    fallback_events.insert(0, data)
    _save_fallback_events()
    print('Stored event in fallback event file:', data)


try:
    print('Checking Firebase key path:', FIREBASE_KEY_PATH)

    if not os.path.exists(FIREBASE_KEY_PATH):
        raise FileNotFoundError(f'Key not found: {FIREBASE_KEY_PATH}')

    print('Key file found')

    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)

    _db = firestore.client()
    print('Firestore initialized successfully')

except Exception as e:
    print('Firestore INIT FAILED:')
    print(e)

_load_fallback_events()


def _is_duplicate_event(data, window_seconds=30):
    if _db is None:
        return False

    if not data.get('email') or not data.get('event') or not data.get('ip'):
        return False

    try:
        cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
        query = (
            _db.collection('events')
            .where('event', '==', data['event'])
            .where('email', '==', data['email'])
            .where('ip', '==', data['ip'])
            .where('device', '==', data.get('device', 'unknown'))
        )
        for doc in query.stream():
            doc_data = doc.to_dict()
            created_at = doc_data.get('created_at')
            if isinstance(created_at, datetime) and created_at >= cutoff:
                print('Duplicate event detected, skipping store:', data)
                return True
    except Exception as e:
        print('Duplicate check failed:', e)

    return False


def store_event(data):
    print('store_event FUNCTION CALLED')

    if 'created_at' not in data:
        data['created_at'] = datetime.utcnow().isoformat() + 'Z'

    if _db is not None:
        try:
            if _is_duplicate_event(data):
                return
            data['created_at'] = firestore.SERVER_TIMESTAMP
            print('Writing to Firestore:', data)
            _db.collection('events').add(data)
            print('Event stored successfully')
            return
        except Exception as e:
            print('Failed to store event in Firestore:', e)
            print('Falling back to local event storage')

    _store_fallback_event(data)


def get_events():
    if _db is None:
        print('Skipping events fetch, Firestore is not initialized. Using fallback events.')
        return fallback_events

    try:
        docs = (
            _db.collection('events')
            .order_by('created_at', direction=firestore.Query.DESCENDING)
            .stream()
        )
        events = []

        for doc in docs:
            event = doc.to_dict()
            event['trust_score'] = event.get('trust_score', 0)
            event['action'] = event.get('action', 'UNKNOWN')
            event['id'] = doc.id
            events.append(event)

        return events
    except Exception as e:
        print('Failed to fetch events from Firestore:', e)
        print('Using fallback events instead.')
        return fallback_events


def is_new_ip(session_id, ip):
    if _db is None:
        print('Skipping IP check, Firestore is not initialized.')
        return False

    docs = _db.collection('events') \
        .where('session_id', '==', session_id) \
        .stream()

    previous_ips = [doc.to_dict().get('ip') for doc in docs]

    return ip not in previous_ips