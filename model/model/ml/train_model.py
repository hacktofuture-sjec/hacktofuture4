import os
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

import matplotlib.pyplot as plt
import seaborn as sns

print("=" * 60)
print("  Failure Classifier - Training")
print("=" * 60)

# --------------------------------------------------
# Paths
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "telemetry_dataset.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, "classifier.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")
CM_PATH = os.path.join(MODEL_DIR, "confusion_matrix.png")

# --------------------------------------------------
# Load dataset
# --------------------------------------------------
df = pd.read_csv(DATA_PATH)
print(f"[INFO] Loaded {len(df)} rows from {DATA_PATH}")

# --------------------------------------------------
# Features & Target
# --------------------------------------------------
X = df.drop("label", axis=1)
y = df["label"]

# Encode labels
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

print(f"[INFO] Classes: {list(label_encoder.classes_)}")

# --------------------------------------------------
# Train/Test split
# --------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

print(f"[INFO] Train: {len(X_train)} | Test: {len(X_test)}")

# --------------------------------------------------
# Train model
# --------------------------------------------------
clf = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

clf.fit(X_train, y_train)
print("[OK] Model trained.")

# --------------------------------------------------
# Evaluation
# --------------------------------------------------
y_pred = clf.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\n" + "=" * 60)
print(f"  ACCURACY: {accuracy:.4f}")
print("=" * 60)

print("\nClassification Report:\n")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))

cm = confusion_matrix(y_test, y_pred)

print("\nConfusion Matrix:\n")
print(cm)

# Save confusion matrix image
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=label_encoder.classes_,
            yticklabels=label_encoder.classes_)
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.title("Confusion Matrix")

plt.savefig(CM_PATH)
plt.close()

print(f"[OK] Confusion matrix image saved -> {CM_PATH}")

# --------------------------------------------------
# Feature Importance
# --------------------------------------------------
print("\nFeature Importances:")
for name, importance in zip(X.columns, clf.feature_importances_):
    print(f"    {name:25s}: {importance:.4f}")

# --------------------------------------------------
# SAVE MODEL (IMPORTANT PART)
# --------------------------------------------------
joblib.dump(clf, MODEL_PATH)
joblib.dump(label_encoder, ENCODER_PATH)

print(f"\n[SAVED] Model   -> {MODEL_PATH}")
print(f"[SAVED] Encoder -> {ENCODER_PATH}")

print("\n[DONE] Training complete!")