import numpy as np
import joblib

model = joblib.load('models/validator_model.pkl')

def predict_validator(seismic_magnitude, gas_ppm, pir_count, event_duration_ms):
    """
    Input: combined reading from all sensors
    Output: is this a genuine crisis or false alarm?
    """
    features = np.array([[seismic_magnitude, gas_ppm, pir_count, event_duration_ms]])
    
    # Isolation Forest: -1 = anomaly (fake), 1 = normal (real crisis pattern)
    prediction = model.predict(features)[0]
    anomaly_score = model.score_samples(features)[0]
    
    # Convert score to false alarm probability (score closer to -1 = more anomalous)
    false_alarm_prob = round(max(0, min(1, (-anomaly_score - 0.3) * 2)), 2)
    is_genuine = prediction == 1 or false_alarm_prob < 0.3
    
    return {
        "is_genuine_event": bool(is_genuine),
        "anomaly_score": round(float(anomaly_score), 3),
        "false_alarm_probability": false_alarm_prob
    }

if __name__ == "__main__":
    result = predict_validator(
        seismic_magnitude=4.2,
        gas_ppm=450,
        pir_count=8,
        event_duration_ms=1200
    )
    print("Validation result:", result)