import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
from tensorflow import keras

# Load data
df = pd.read_csv('data/seismic_data.csv')
X = df.drop('label', axis=1).values  # shape: (samples, 150)
y = df['label'].values

# Reshape for 1D CNN: (samples, timesteps, features)
# 50 timesteps, 3 features (x,y,z)
X = X.reshape(-1, 50, 3)

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Build 1D CNN — keep it small and fast
model = keras.Sequential([
    keras.layers.Conv1D(32, kernel_size=3, activation='relu', input_shape=(50, 3)),
    keras.layers.Conv1D(64, kernel_size=3, activation='relu'),
    keras.layers.GlobalMaxPooling1D(),
    keras.layers.Dense(64, activation='relu'),
    keras.layers.Dropout(0.3),
    keras.layers.Dense(4, activation='softmax')  # 4 classes
])

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

print("Training seismic model...")
model.fit(X_train, y_train, epochs=20, batch_size=32, validation_data=(X_test, y_test))

# Save model
model.save('models/seismic_model.keras')
print("Seismic model saved!")

# Test it
loss, acc = model.evaluate(X_test, y_test)
print(f"Test accuracy: {acc:.2%}")