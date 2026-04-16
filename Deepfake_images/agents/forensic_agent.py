import cv2
import numpy as np

class ForensicAgent:
    def analyze(self, img_path):
        img = cv2.imread(img_path, 0)
        if img is None:
            return {
                "forensic_score": 0.0,
                "artifact_score": 0.0,
                "lighting_consistency": 0.0,
                "status": "Error"
            }

        blur = cv2.GaussianBlur(img, (5, 5), 0)
        noise = np.mean(cv2.absdiff(img, blur))
        
        # Simulating more forensic metrics
        artifact_score = min(100, noise * 8)
        lighting_consistency = max(0, 100 - (noise * 5))

        return {
            "forensic_score": float(noise * 4), # Scaling for UI
            "artifact_score": float(artifact_score),
            "lighting_consistency": float(lighting_consistency),
            "status": "Suspicious" if noise > 10 else "Normal"
        }