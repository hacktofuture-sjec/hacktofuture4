import numpy as np
import joblib

model = joblib.load('models/survivor_model.pkl')
if not hasattr(model, 'multi_class'):
    model.multi_class = 'auto'
scaler = joblib.load('models/survivor_scaler.pkl')

def predict_survivor(pir_count, time_since_event_mins, magnitude):
    """
    Input: PIR trigger count, minutes since event, seismic magnitude
    Output: survivor probability dict
    """
    features = np.array([[pir_count, time_since_event_mins, magnitude]])
    features_scaled = scaler.transform(features)
    
    probability = model.predict_proba(features_scaled)[0][1]
    
    if probability > 0.75:
        urgency = 'immediate'
        estimated_count = f"{max(1, pir_count // 3)}-{max(2, pir_count // 2)}"
    elif probability > 0.45:
        urgency = 'high'
        estimated_count = "1-2"
    else:
        urgency = 'low'
        estimated_count = "unknown"
    
    return {
        "survivor_probability": round(float(probability), 2),
        "estimated_count": estimated_count,
        "urgency": urgency,
        "pir_detections": pir_count
    }

if __name__ == "__main__":
    result = predict_survivor(pir_count=12, time_since_event_mins=8, magnitude=4.2)
    print("Survivor prediction:", result)