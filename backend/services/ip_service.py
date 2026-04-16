import requests
from .firestore_service import store_event 

def get_location(ip):
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return "Local Network"

    try:
        # Primary API: ip-api.com (free, no key required)
        response = requests.get(f"http://ip-api.com/json/{ip}", timeout=5)
        data = response.json()
        
        if response.status_code == 200 and data.get("status") == "success":
            city = data.get("city", "")
            region = data.get("regionName", "")
            country = data.get("country", "")
            
            # Build location string: City, Region, Country
            location_parts = [part for part in [city, region, country] if part]
            location = ", ".join(location_parts) if location_parts else "Unknown"
            
            store_event({"ip": ip, "location": location, "action": "IP_LOCATION_FETCH"})
            return location
        else:
            # Fallback API: ipapi.co
            response_fallback = requests.get(f"https://ipapi.co/{ip}/json/", timeout=5)
            data_fallback = response_fallback.json()
            
            city = data_fallback.get("city", "")
            region = data_fallback.get("region", "")
            country = data_fallback.get("country_name", "")
            
            location_parts = [part for part in [city, region, country] if part]
            location = ", ".join(location_parts) if location_parts else "Unknown"
            
            store_event({"ip": ip, "location": location, "action": "IP_LOCATION_FETCH_FALLBACK"})
            return location
            
    except Exception as e:
        print(f"Location lookup error for IP {ip}: {e}")
        return "Unknown"