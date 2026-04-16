# def detect_anomaly(signals):
#     if signals["cpu"] > 90:
#         return True
#     if signals["memory"] > 90:
#         return True
#     if signals["restarts"] > 3:
#         return True
#     if signals["latency"] > 2000:
#         return True
#     return False
def detect_anomaly(signals):
    cpu = signals.get("cpu", 0)
    memory = signals.get("memory", 0)
    restarts = signals.get("restarts", 0)
    latency = signals.get("latency", 0)

    if cpu > 85:
        return True
    if memory > 85:
        return True
    if restarts > 2:
        return True
    if latency > 1000:
        return True

    return False

#for anamoly
# def detect_anomaly(signals):
#     return True