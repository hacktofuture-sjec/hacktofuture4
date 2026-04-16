class ReasoningAgent:
    def analyze(self, det, foren, meta):

        explanation = []

        if det["prediction"] == "fake":
            explanation.append("AI model detected fake patterns")

        if foren["forensic_score"] > 40: # Updated for new scaling
            explanation.append("High noise inconsistency detected")

        if meta.get("source_exif") == "Missing":
            explanation.append("Missing source metadata signatures")

        if meta.get("device_info") == "Unknown":
            explanation.append("Unknown capture device fingerprint")

        return {
            "final_verdict": det["prediction"],
            "confidence": det["confidence"],
            "explanation": explanation
        }