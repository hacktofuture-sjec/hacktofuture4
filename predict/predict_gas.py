import numpy as np
import joblib

model = joblib.load('models/gas_model.pkl')
LABELS = ['safe', 'LPG_leak', 'smoke_fire']

def predict_gas(ppm_readings_30, seismic_flag):
    """
    Input: 30 PPM readings + seismic flag (0 or 1)
    Output: hazard classification dict
    """
    features = list(ppm_readings_30) + [seismic_flag]
    features = np.array(features).reshape(1, -1)
    
    probabilities = model.predict_proba(features)[0]
    predicted_class = np.argmax(probabilities)
    confidence = float(probabilities[predicted_class])
    hazard_type = LABELS[predicted_class]
    
    current_ppm = float(ppm_readings_30[-1])
    
    if current_ppm > 500 or hazard_type != 'safe':
        severity = 'critical'
        entry_safe = False
    elif current_ppm > 200:
        severity = 'warning'
        entry_safe = False
    else:
        severity = 'normal'
        entry_safe = True
    
    return {
        "hazard_type": hazard_type,
        "current_ppm": round(current_ppm, 1),
        "severity": severity,
        "entry_safe": entry_safe,
        "confidence": round(confidence, 2)
    }

if __name__ == "__main__":
    fake_lpg = np.linspace(60, 800, 30)
    result = predict_gas(fake_lpg, seismic_flag=1)
    print("Gas prediction:", result)