import numpy as np
import tensorflow as tf

model = tf.keras.models.load_model('models/seismic_model.keras')

LABELS = ['normal', 'truck_passing', 'structural_collapse', 'earthquake']
MAGNITUDES = ['none', 'low', 'medium', 'high']

def predict_seismic(readings_50x3):
    """
    Input: numpy array of shape (50, 3) — 50 readings of X,Y,Z
    Output: dict with event type, magnitude, confidence
    """
    input_data = readings_50x3.reshape(1, 50, 3)
    probabilities = model.predict(input_data, verbose=0)[0]
    
    predicted_class = np.argmax(probabilities)
    confidence = float(probabilities[predicted_class])
    event_type = LABELS[predicted_class]
    
    # Estimate magnitude from max acceleration
    max_accel = float(np.max(np.abs(readings_50x3)))
    if max_accel < 0.5:
        magnitude = 'none'
    elif max_accel < 2:
        magnitude = 'low'
    elif max_accel < 4:
        magnitude = 'medium'
    else:
        magnitude = 'high'
    
    return {
        "event_type": event_type,
        "magnitude": magnitude,
        "confidence": round(confidence, 2),
        "is_crisis": event_type in ['structural_collapse', 'earthquake']
    }

# Test with fake data
if __name__ == "__main__":
    fake_collapse = np.random.normal(0, 2, (50, 3))
    fake_collapse[10] = [5, 4, 3]  # spike
    result = predict_seismic(fake_collapse)
    print("Seismic prediction:", result)