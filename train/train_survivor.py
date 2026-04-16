import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import StandardScaler
import joblib

df = pd.read_csv('data/survivor_data.csv')
X = df.drop('survivor_present', axis=1).values
y = df['survivor_present'].values

scaler = StandardScaler()
X = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LogisticRegression()
model.fit(X_train, y_train)

acc = accuracy_score(y_test, model.predict(X_test))
print(f"Survivor model accuracy: {acc:.2%}")

joblib.dump(model, 'models/survivor_model.pkl')
joblib.dump(scaler, 'models/survivor_scaler.pkl')
print("Survivor model saved!")