import numpy as np
import pandas as pd

samples = []

# Normal air — low stable PPM
for _ in range(300):
    ppm = np.random.normal(50, 10, 30)  # 30 readings
    seismic_flag = 0
    samples.append(list(ppm) + [seismic_flag, 0])  # label 0 = safe

# LPG leak — rapidly rising PPM after seismic event
for _ in range(250):
    base = np.random.uniform(50, 100)
    ppm = [base + i * np.random.uniform(20, 40) for i in range(30)]
    ppm = np.clip(ppm, 0, 10000)
    seismic_flag = 1
    samples.append(list(ppm) + [seismic_flag, 1])  # label 1 = LPG

# Smoke/fire — sudden jump then plateau
for _ in range(250):
    ppm = np.random.normal(60, 15, 30)
    jump_point = np.random.randint(5, 15)
    ppm[jump_point:] = np.random.uniform(600, 900, 30 - jump_point)
    seismic_flag = np.random.choice([0, 1])
    samples.append(list(ppm) + [seismic_flag, 2])  # label 2 = smoke

df = pd.DataFrame(samples)
df.columns = [f'ppm_{i}' for i in range(30)] + ['seismic_flag', 'label']
df.to_csv('data/gas_data.csv', index=False)
print("Gas data generated:", len(df), "samples")