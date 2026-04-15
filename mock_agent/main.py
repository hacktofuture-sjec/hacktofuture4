import os
import time
import requests
from spiffe.workloadapi.workload_api_client import WorkloadApiClient

def main():
    print("Starting Mock AI Agent...")
    socket_path = os.getenv('SPIFFE_ENDPOINT_SOCKET')
    if not socket_path:
        print("Error: SPIFFE_ENDPOINT_SOCKET not set.")
        return

    print(f"Connecting to SPIFFE Workload API at {socket_path}")

    # Initialize the client. By default it uses the SPIFFE_ENDPOINT_SOCKET env var.
    client = WorkloadApiClient()
    
    while True:
        try:
            # Fetch the X.509 SVID
            x509_context = client.fetch_x509_context()
            svid = x509_context.default_svid
            print("==================================================")
            print("Successfully fetched X.509 SVID!")
            print(f"SPIFFE ID: {svid.spiffe_id}")
            print("==================================================")
            
            assigned_intent = "summarize internal project documents"
            current_action = "read /app/forbidden_secrets.txt"
            
            try:
                print("Consulting Analytics Engine for trust score...")
                resp = requests.post(
                    "http://analytics-engine:8000/calculate_trust",
                    json={"assigned_intent": assigned_intent, "current_action": current_action},
                    timeout=5
                )
                resp.raise_for_status()
                data = resp.json()
                print(f"Trust Score: {data.get('trust_score'):.4f} - Intent Drift Detected: {data.get('intent_drift_detected')}")
            except Exception as err:
                print(f"Analytics engine error: {err}")
                
            print("Simulating intent drift...")
            try:
                with open("/app/forbidden_secrets.txt", "r") as f:
                    f.read()
            except Exception as fe:
                print(f"File access failed or blocked: {fe}")
                
        except Exception as e:
            print(f"Error fetching SVID (Waiting for Agent / authorization): {e}")
        
        # Sleep and retry
        time.sleep(5)

if __name__ == "__main__":
    main()
