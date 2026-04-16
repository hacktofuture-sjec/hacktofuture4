import requests
from .firestore_service import store_event 

def get_location(ip):
    try:
        response = requests.get(f"http://ip-api.com/json/{ip}")
        data = response.json()
        country = data.get("country", "Unknown")
        

        store_event({"ip": ip, "country": country, "action": "IP_LOCATION_FETCH"})
        
        return country
    except:
        return "Unknown"