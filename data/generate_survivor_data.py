import numpy as np
import pandas as pd

samples = []

# Survivors present — high PIR, magnitude medium/high, recent event
for _ in range(300):
    pir_count = np.random.randint(5, 20)       # lots of movement
    time_since_event = np.random.uniform(0, 30) # recent (minutes)
    magnitude = np.random.uniform(2, 5)
    samples.append([pir_count, time_since_event, magnitude, 1])

# No survivors / deeply buried — low PIR, high magnitude
for _ in range(300):
    pir_count = np.random.randint(0, 2)
    time_since_event = np.random.uniform(60, 360)
    magnitude = np.random.uniform(3, 6)
    samples.append([pir_count, time_since_event, magnitude, 0])

# Uncertain — some PIR, moderate conditions
for _ in range(200):
    pir_count = np.random.randint(1, 5)
    time_since_event = np.random.uniform(20, 90)
    magnitude = np.random.uniform(1.5, 3.5)
    samples.append([pir_count, time_since_event, magnitude, np.random.choice([0, 1])])

df = pd.DataFrame(samples, columns=['pir_count', 'time_since_event_mins', 'magnitude', 'survivor_present'])
df.to_csv('data/survivor_data.csv', index=False)
print("Survivor data generated:", len(df), "samples")