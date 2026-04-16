import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image

class DetectionAgent:
    def __init__(self):
        self.model = load_model(
            r"D:\DeepFake-Image\models\deepfake_model.h5", compile=False
        )
        self.class_names = ['fake', 'real']

    def analyze(self, img_path):
        img = image.load_img(img_path, target_size=(256, 256))
        img = image.img_to_array(img) / 255.0
        img = np.expand_dims(img, axis=0)

        result = self.model.predict(img)

        prediction = self.class_names[np.argmax(result)]
        confidence = float(np.max(result) * 100)

        return {
            "prediction": prediction,
            "confidence": round(confidence, 2)
        }