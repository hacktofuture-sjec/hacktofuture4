import os

# Use absolute path to ensure the key file is found
FIREBASE_KEY_PATH = os.path.join(os.path.dirname(__file__), 'firebase_key.json')

TRUST_THRESHOLD_LOW = 40
TRUST_THRESHOLD_MEDIUM = 60