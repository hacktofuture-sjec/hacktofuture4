import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

# Try to import Gemini only if key exists
if api_key:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("models/gemini-1.5-flash-latest")
else:
    model = None


def analyze_incident(signals):
    # If no API → fallback (VERY IMPORTANT)
    if model is None:
        return f"""
        Root Cause: High resource usage detected
        Recommended Action: Restart pod or scale deployment

        Details:
        CPU={signals['cpu']}%
        Memory={signals['memory']}%
        Restarts={signals['restarts']}
        Latency={signals['latency']}ms
        Error Rate={signals['error_rate']}
        """

    # If API exists → use Gemini
    prompt = f"""
    Analyze Kubernetes anomaly:
    CPU={signals['cpu']}%
    Memory={signals['memory']}%
    Restarts={signals['restarts']}
    Latency={signals['latency']}ms
    Error Rate={signals['error_rate']}

    Return:
    Root Cause:
    Recommended Action:
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception:
        return "AI analysis failed. Using fallback recovery."