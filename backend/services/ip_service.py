import requests

def get_location(ip):
    try:
        response = requests.get(f"http://ip-api.com/json/{ip}")
        data = response.json()
        return data.get("country", "Unknown")
    except:
        return "Unknown"