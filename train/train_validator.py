import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Real crisis signatures — all sensors fire together
real_events = []
for _ in range(400):
    seismic_mag = np.random.uniform(2, 6)
    gas_ppm = np.random.uniform(200, 800)
    pir_count = np.random.randint(3, 20)
    event_duration = np.random.uniform(300, 2000)  # ms
    real_events.append([seismic_mag, gas_ppm, pir_count, event_duration])

# Only train on real events — Isolation Forest learns what normal crisis looks like
X_train = np.array(real_events)

model = IsolationForest(contamination=0.1, random_state=42)
model.fit(X_train)

joblib.dump(model, 'models/validator_model.pkl')
print("Validator model saved!")