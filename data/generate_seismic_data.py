import numpy as np
import pandas as pd

# Each sample = 50 readings of X,Y,Z = 150 numbers + 1 label
# Labels: 0=normal, 1=truck, 2=collapse, 3=earthquake

samples = []

# Normal state — small random noise around 0
for _ in range(300):
    x = np.random.normal(0, 0.05, 50)
    y = np.random.normal(0, 0.05, 50)
    z = np.random.normal(1, 0.05, 50)  # z=1G always due to gravity
    samples.append(np.concatenate([x, y, z, [0]]))

# Truck passing — single short spike then back to normal
for _ in range(200):
    x = np.random.normal(0, 0.05, 50)
    y = np.random.normal(0, 0.05, 50)
    z = np.random.normal(1, 0.05, 50)
    spike_pos = np.random.randint(10, 40)
    x[spike_pos] = np.random.uniform(1.5, 2.5)  # one spike only
    samples.append(np.concatenate([x, y, z, [1]]))

# Building collapse — sharp spike then sustained irregular tremor
for _ in range(300):
    x = np.random.normal(0, 0.05, 50)
    y = np.random.normal(0, 0.05, 50)
    z = np.random.normal(1, 0.05, 50)
    spike_pos = np.random.randint(5, 15)
    # Sharp initial spike
    x[spike_pos] = np.random.uniform(3, 5)
    y[spike_pos] = np.random.uniform(2, 4)
    # Sustained tremor after spike
    for i in range(spike_pos+1, 50):
        x[i] = np.random.normal(0, 0.8)  # irregular sustained motion
        y[i] = np.random.normal(0, 0.6)
    samples.append(np.concatenate([x, y, z, [2]]))

# Earthquake — wave pattern, rhythmic oscillation
for _ in range(300):
    t = np.linspace(0, 5, 50)
    freq = np.random.uniform(1, 4)
    amplitude = np.random.uniform(1.5, 4)
    x = amplitude * np.sin(2 * np.pi * freq * t) + np.random.normal(0, 0.1, 50)
    y = amplitude * np.cos(2 * np.pi * freq * t) + np.random.normal(0, 0.1, 50)
    z = np.random.normal(1, 0.3, 50)
    samples.append(np.concatenate([x, y, z, [3]]))

df = pd.DataFrame(samples)
df.columns = [f'f{i}' for i in range(150)] + ['label']
df.to_csv('data/seismic_data.csv', index=False)
print("Seismic data generated:", len(df), "samples")