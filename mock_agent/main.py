import os
import time
import requests
import uuid
from datetime import datetime
from spiffe.workloadapi.workload_api_client import WorkloadApiClient

def main():
    print("Starting Aegis Workload Observer...")
    socket_path = os.getenv('SPIFFE_ENDPOINT_SOCKET')
    if not socket_path:
        print("Error: SPIFFE_ENDPOINT_SOCKET not set.")
        return

    print(f"Connecting to SPIFFE Workload API at {socket_path}")

    # Initialize the client. By default it uses the SPIFFE_ENDPOINT_SOCKET env var.
    client = WorkloadApiClient()
    
    # Track if we've already reported an incident this cycle
    reported_incident = False
    
    while True:
        try:
            # Fetch the X.509 SVID
            x509_context = client.fetch_x509_context()
            svid = x509_context.default_svid
            print("===================================================")
            print("Workload Identity Verified (SPIFFE SVID)")
            print(f"SPIFFE ID: {svid.spiffe_id}")
            print("===================================================")
            
            try:
                # Fetch current trust state from analytics engine
                resp = requests.get("http://analytics-engine:8000/latest_score", timeout=5)
                resp.raise_for_status()
                data = resp.json()
                trust_score = data.get('trust_score', 1.0)
                drift_detected = data.get('intent_drift_detected', False)
                
                print(f"Trust Score: {trust_score:.4f} - Intent Drift Detected: {drift_detected}")
                
                # Only report an incident once per detection cycle
                if drift_detected and not reported_incident:
                    print("[REAL INCIDENT] Drift detected. Creating backend incident for HITL...")
                    try:
                        incident_response = requests.post(
                            "http://analytics-engine:8000/incidents/create",
                            json={
                                "id": str(uuid.uuid4()),
                                "detected_at": datetime.utcnow().isoformat(),
                                "severity": "HIGH",
                                "description": f"Intent drift detected: trust_score={trust_score:.4f}"
                            },
                            timeout=5
                        )
                        incident_response.raise_for_status()
                        print(f"Incident created: {incident_response.json()}")
                        reported_incident = True
                    except Exception as err:
                        print(f"Failed to create incident: {err}")
                elif not drift_detected:
                    reported_incident = False
                    print("Workload behavior nominal. Ready for next observation cycle.")
                    
            except Exception as err:
                print(f"Analytics engine error: {err}")
                
        except Exception as e:
            print(f"Error fetching SVID (Waiting for Agent / authorization): {e}")
        
        # Sleep and retry
        time.sleep(5)

if __name__ == "__main__":
    main()

