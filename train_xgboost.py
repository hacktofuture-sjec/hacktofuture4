import pandas as pd
import numpy as np
import os
import random
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)
import matplotlib.pyplot as plt

print("=" * 60)
print("📊 PASHUMITRA — XGBOOST MODEL TRAINING")
print("=" * 60)

MODEL_SAVE_DIR = "ml_models"
os.makedirs(MODEL_SAVE_DIR, exist_ok=True)

print("\n📋 PART A: Generating dataset...")

random.seed(42)
np.random.seed(42)

def generate_dataset(n=1000):
    data = []
    species_list = ['cow', 'buffalo', 'goat', 'sheep']
    species_weights = [0.45, 0.30, 0.15, 0.10]
    season_list = ['summer', 'monsoon', 'winter', 'spring']
    breed_map = {'cow': [1,2,3,4], 'buffalo': [5,6,7], 'goat': [8,9], 'sheep': [10,11]}
    weight_range = {'cow': (250,450), 'buffalo': (400,600), 'goat': (25,50), 'sheep': (25,50)}
    
    for i in range(n):
        species = random.choices(species_list, weights=species_weights, k=1)[0]
        breed = random.choice(breed_map[species])
        age = random.randint(12, 156)
        w_min, w_max = weight_range[species]
        weight = round(random.uniform(w_min, w_max), 1)
        num_calvings = random.randint(0, min(7, age // 24))
        days_last_calving = random.randint(30, 300) if num_calvings > 0 else 0
        cycle_reg = round(random.uniform(0.3, 0.95), 2)
        season = random.choice(season_list)
        hour = random.randint(4, 20)
        days_last_heat = random.randint(14, 80)
        days_last_ai = random.randint(0, 200) if num_calvings > 0 else 0
        
        cycle_match = 1 if 17 <= days_last_heat <= 24 else 0
        
        if cycle_match and random.random() < 0.75:
            is_heat = 1
            q = [random.choices([1,0], weights=[w, 1-w])[0] 
                 for w in [0.85, 0.75, 0.80, 0.60, 0.30, 0.65, 0.35, 0.70]]
        else:
            is_heat = 0
            q = [random.choices([1,0], weights=[w, 1-w])[0] 
                 for w in [0.10, 0.08, 0.05, 0.05, 0.15, 0.10, 0.12, 0.03]]
        
        health = 'low'
        if q[4] and q[6] and not is_heat:
            health = random.choices(['low','medium','high'], weights=[0.3,0.5,0.2])[0]
        elif age > 120 and num_calvings > 5:
            health = random.choices(['low','medium','high'], weights=[0.4,0.4,0.2])[0]
        
        data.append({
            'species': species, 'breed_encoded': breed, 'age_months': age,
            'weight_kg': weight, 'num_calvings': num_calvings,
            'days_since_last_calving': days_last_calving,
            'days_since_last_heat': days_last_heat, 'days_since_last_ai': days_last_ai,
            'cycle_regularity': cycle_reg,
            'q_restless': q[0], 'q_swelling': q[1], 'q_mucus': q[2],
            'q_mounting': q[3], 'q_appetite_reduced': q[4], 'q_bellowing': q[5],
            'q_milk_reduced': q[6], 'q_standing_heat': q[7],
            'symptom_score': sum(q), 'hour_of_day': hour, 'season': season,
            'is_in_heat': is_heat, 'health_risk': health
        })
    return pd.DataFrame(data)

df = generate_dataset(1000)
df.to_csv('tabular_dataset.csv', index=False)

print(f"   ✅ Generated: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"   ✅ Saved: tabular_dataset.csv")
print(f"\n   Heat distribution:")
print(f"      Not in heat: {(df['is_in_heat']==0).sum()} ({(df['is_in_heat']==0).mean()*100:.1f}%)")
print(f"      In heat:     {(df['is_in_heat']==1).sum()} ({(df['is_in_heat']==1).mean()*100:.1f}%)")


print("\n🔧 PART B: Creating smart features...")

species_encoder = LabelEncoder()
df['species_encoded'] = species_encoder.fit_transform(df['species'])

season_encoder = LabelEncoder()
df['season_encoded'] = season_encoder.fit_transform(df['season'])


df['days_since_heat_mod21'] = df['days_since_last_heat'] % 21
df['is_cycle_window'] = ((df['days_since_heat_mod21'] >= 18) | 
                          (df['days_since_heat_mod21'] <= 3)).astype(int)
df['high_symptom'] = (df['symptom_score'] >= 5).astype(int)
df['calving_recovery'] = (df['days_since_last_calving'] >= 60).astype(int)
df['symptom_x_cycle'] = df['symptom_score'] * df['is_cycle_window']

print("   ✅ Feature 1: days_since_heat_mod21 → Where in 21-day cycle?")
print("   ✅ Feature 2: is_cycle_window       → Near expected heat time?")
print("   ✅ Feature 3: high_symptom          → 5+ symptoms positive?")
print("   ✅ Feature 4: calving_recovery      → Recovered from calving?")
print("   ✅ Feature 5: symptom_x_cycle       → Symptoms × cycle interaction")


# PART C: SPLIT DATA

print("\n📐 PART C: Splitting data...")

FEATURE_COLUMNS = [
    'species_encoded', 'breed_encoded', 'age_months', 'weight_kg',
    'num_calvings', 'days_since_last_calving', 'days_since_last_heat',
    'days_since_last_ai', 'cycle_regularity',
    'q_restless', 'q_swelling', 'q_mucus', 'q_mounting',
    'q_appetite_reduced', 'q_bellowing', 'q_milk_reduced', 'q_standing_heat',
    'symptom_score', 'hour_of_day', 'season_encoded',
    'days_since_heat_mod21', 'is_cycle_window', 'high_symptom',
    'calving_recovery', 'symptom_x_cycle'
]

X = df[FEATURE_COLUMNS]
y = df['is_in_heat']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"   ✅ Total features: {len(FEATURE_COLUMNS)}")
print(f"   ✅ Training rows:  {X_train.shape[0]}")
print(f"   ✅ Test rows:      {X_test.shape[0]}")


print("\n🚀 PART D: Training XGBoost...")

xgb_model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=3,
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    scale_pos_weight=len(y_train[y_train==0]) / len(y_train[y_train==1]),
    random_state=42,
    eval_metric='logloss',
    use_label_encoder=False
)

xgb_model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=50
)

print("\n   ✅ Training complete!")


print("\n📊 PART E: Evaluation Results")
print("=" * 60)

y_pred = xgb_model.predict(X_test)

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred)
rec = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)

print(f"\n   🎯 Accuracy:  {acc*100:.1f}%")
print(f"   🎯 Precision: {prec*100:.1f}%")
print(f"   🎯 Recall:    {rec*100:.1f}%")
print(f"   🎯 F1 Score:  {f1*100:.1f}%")

cm = confusion_matrix(y_test, y_pred)
print(f"\n   Confusion Matrix:")
print(f"                      Predicted")
print(f"                   No Heat  In Heat")
print(f"   Actual No Heat    {cm[0][0]:4d}     {cm[0][1]:4d}")
print(f"   Actual In Heat    {cm[1][0]:4d}     {cm[1][1]:4d}")

print("\n📊 PART F: Most Important Features")
print("-" * 50)

importance = xgb_model.feature_importances_
feat_imp = sorted(zip(FEATURE_COLUMNS, importance), key=lambda x: x[1], reverse=True)

for rank, (feat, imp) in enumerate(feat_imp[:10], 1):
    bar = "█" * int(imp * 80)
    print(f"   {rank:2d}. {feat:30s} {imp:.4f} {bar}")


fig, ax = plt.subplots(figsize=(10, 6))
top10 = feat_imp[:10]
ax.barh([f[0] for f in reversed(top10)], [f[1] for f in reversed(top10)], color='#4CAF50')
ax.set_xlabel('Importance')
ax.set_title('PashuMitra — Top 10 Feature Importance', fontweight='bold')
plt.tight_layout()
plt.savefig(os.path.join(MODEL_SAVE_DIR, 'feature_importance.png'), dpi=150)
print(f"\n   ✅ Chart saved: {MODEL_SAVE_DIR}/feature_importance.png")


print("\n💾 PART G: Saving models...")

joblib.dump(xgb_model, os.path.join(MODEL_SAVE_DIR, 'xgboost_estrus.pkl'))
joblib.dump(species_encoder, os.path.join(MODEL_SAVE_DIR, 'species_encoder.pkl'))
joblib.dump(season_encoder, os.path.join(MODEL_SAVE_DIR, 'season_encoder.pkl'))

with open(os.path.join(MODEL_SAVE_DIR, 'feature_columns.json'), 'w') as f:
    json.dump(FEATURE_COLUMNS, f)

print("   ✅ xgboost_estrus.pkl")
print("   ✅ species_encoder.pkl")
print("   ✅ season_encoder.pkl")
print("   ✅ feature_columns.json")


print("\n🧪 PART H: Quick test...")

def quick_predict(data, label):
    d = data.copy()
    d['species_encoded'] = species_encoder.transform([d['species']])[0]
    d['season_encoded'] = season_encoder.transform([d['season']])[0]
    symp = sum([d[k] for k in ['q_restless','q_swelling','q_mucus','q_mounting',
                                'q_appetite_reduced','q_bellowing','q_milk_reduced','q_standing_heat']])
    d['symptom_score'] = symp
    d['days_since_heat_mod21'] = d['days_since_last_heat'] % 21
    d['is_cycle_window'] = int(d['days_since_heat_mod21'] >= 18 or d['days_since_heat_mod21'] <= 3)
    d['high_symptom'] = int(symp >= 5)
    d['calving_recovery'] = int(d['days_since_last_calving'] >= 60)
    d['symptom_x_cycle'] = symp * d['is_cycle_window']
    
    features = [d[col] for col in FEATURE_COLUMNS]
    df_in = pd.DataFrame([features], columns=FEATURE_COLUMNS)
    prob = float(xgb_model.predict_proba(df_in)[0][1])
    result = "🔥 IN HEAT" if prob >= 0.5 else "❄️ NOT IN HEAT"
    
    print(f"\n   {label}:")
    print(f"      Symptoms: {symp}/8 | Day: {d['days_since_last_heat']} | Species: {d['species']}")
    print(f"      Heat Probability: {prob:.1%}")
    print(f"      Prediction: {result}")


quick_predict({
    'species': 'cow', 'breed_encoded': 3, 'age_months': 48,
    'weight_kg': 350, 'num_calvings': 2, 'days_since_last_calving': 90,
    'days_since_last_heat': 21, 'days_since_last_ai': 60, 'cycle_regularity': 0.85,
    'q_restless': 1, 'q_swelling': 1, 'q_mucus': 1, 'q_mounting': 1,
    'q_appetite_reduced': 0, 'q_bellowing': 1, 'q_milk_reduced': 0, 'q_standing_heat': 1,
    'hour_of_day': 6, 'season': 'winter'
}, "TEST 1 — Cow, 6 symptoms, day 21")


quick_predict({
    'species': 'cow', 'breed_encoded': 3, 'age_months': 48,
    'weight_kg': 350, 'num_calvings': 2, 'days_since_last_calving': 90,
    'days_since_last_heat': 45, 'days_since_last_ai': 60, 'cycle_regularity': 0.85,
    'q_restless': 0, 'q_swelling': 0, 'q_mucus': 0, 'q_mounting': 0,
    'q_appetite_reduced': 0, 'q_bellowing': 0, 'q_milk_reduced': 0, 'q_standing_heat': 0,
    'hour_of_day': 12, 'season': 'winter'
}, "TEST 2 — Cow, 0 symptoms, day 45")


quick_predict({
    'species': 'buffalo', 'breed_encoded': 5, 'age_months': 60,
    'weight_kg': 480, 'num_calvings': 3, 'days_since_last_calving': 95,
    'days_since_last_heat': 20, 'days_since_last_ai': 75, 'cycle_regularity': 0.70,
    'q_restless': 1, 'q_swelling': 0, 'q_mucus': 1, 'q_mounting': 0,
    'q_appetite_reduced': 0, 'q_bellowing': 1, 'q_milk_reduced': 0, 'q_standing_heat': 0,
    'hour_of_day': 8, 'season': 'monsoon'
}, "TEST 3 — Buffalo, 3 symptoms, day 20")


print("\n" + "=" * 60)
print("🎉 XGBOOST MODEL TRAINING COMPLETE!")
print("=" * 60)
print(f"""
   📁 Model:    {MODEL_SAVE_DIR}/xgboost_estrus.pkl
   📊 Chart:    {MODEL_SAVE_DIR}/feature_importance.png
   📋 Dataset:  tabular_dataset.csv
   🎯 Accuracy: {acc*100:.1f}%
   🎯 F1 Score: {f1*100:.1f}%

   ✅ XGBoost model is READY!
""")