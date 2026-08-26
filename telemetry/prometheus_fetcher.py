import os
import requests
from dotenv import load_dotenv

load_dotenv()

PROM_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090") + "/api/v1/query"


def extract_value(response_json):
    try:
        result = response_json["data"]["result"]
        if result:
            return float(result[0]["value"][1])
        return 0.0
    except:
        return 0.0


def fetch_metrics():
    cpu_response = requests.get(
        PROM_URL,
        params={"query": "cpu_usage"}
    ).json()

    memory_response = requests.get(
        PROM_URL,
        params={"query": "memory_usage"}
    ).json()

    cpu_value = extract_value(cpu_response)
    memory_value = extract_value(memory_response)

    return {
        "cpu": cpu_value,
        "memory": memory_value
    }