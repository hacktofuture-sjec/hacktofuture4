# What it does:

# Stores incidents and recovery outcomes in Redis.

# PPT Module:

# Learning Loop / Decision Memory
import redis
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def store_incident(incident):
    r.rpush("incident_history", json.dumps(incident))

def get_incidents():
    data = r.lrange("incident_history", 0, -1)
    return [json.loads(x) for x in data]