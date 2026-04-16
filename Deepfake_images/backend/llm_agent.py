import os
import requests
from dotenv import load_dotenv

# Load .env
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


class LLMReasoningAgent:
    def explain(self, data):
        # Construct a detailed prompt for a comprehensive summary
        prompt = f"""
You are DEEPTRUST, an advanced Forensic AI Analyst.
Analyze the following diagnostic vectors from our multi-agent detection swarm:
{data}

Provide a comprehensive AI Summary of the findings. 
Your report must include:
1. A clear Verdict (AUTHENTIC or FAKE).
2. Key evidence points from the detection, forensic, and metadata agents.
3. A final assessment of the overall visual integrity.

CRITICAL RULE: Keep your response professional, authoritative, and concise (under 100 words). Use a forensic tone.
"""

        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": "You are an elite cybersecurity forensic AI analyst."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"Groq API Error ({response.status_code}): {response.text}")
                return f"Neural reasoning link failed: {response.status_code}. Agent offline."

            result = response.json()["choices"][0]["message"]["content"]
            return result

        except Exception as e:
            print(f"Groq Request Exception: {e}")
            return "Neural reasoning engine encountered a critical synchronization error. Diagnostic link severed."