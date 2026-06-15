import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier

print("Demarrage de l'entrainement des modeles...")

# Chargement des donnees
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, 'data', 'telemetry_metrics.csv')

if not os.path.exists(CSV_PATH):
    raise FileNotFoundError(f"Fichier introuvable : {CSV_PATH}")

df = pd.read_csv(CSV_PATH)
print(f"Dataset charge : {df.shape[0]} lignes, {df.shape[1]} colonnes.")

# Definition des variables
features = ['cpu_usage_pct', 'ram_usage_pct', 'cpu_temperature_celsius', 'disk_io_rate', 'network_latency_ms']
target = 'system_status'

X = df[features]
y = df[target]

# Separation train/test
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print("Distribution des classes :")
print(y_train.value_counts(normalize=True))

comparatif_results = {}

# Modele 1 : Regression Logistique
print("Entrainement Regression Logistique...")
lr_model = LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
lr_model.fit(X_train, y_train)
lr_preds = lr_model.predict(X_test)

comparatif_results['Logistic_Regression'] = {
    'accuracy': round(accuracy_score(y_test, lr_preds) * 100, 2),
    'report': classification_report(y_test, lr_preds, output_dict=True)
}
joblib.dump(lr_model, os.path.join(BASE_DIR, 'models', 'logistic_regression_model.pkl'))

# Modele 2 : Random Forest
print("Entrainement Random Forest...")
rf_model = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42, n_jobs=-1)
rf_model.fit(X_train, y_train)
rf_preds = rf_model.predict(X_test)

comparatif_results['Random_Forest'] = {
    'accuracy': round(accuracy_score(y_test, rf_preds) * 100, 2),
    'report': classification_report(y_test, rf_preds, output_dict=True)
}
joblib.dump(rf_model, os.path.join(BASE_DIR, 'models', 'random_forest_model.pkl'))

# Modele 3 : XGBoost
print("Entrainement XGBoost...")
xgb_model = XGBClassifier(n_estimators=100, random_state=42, eval_metric='mlogloss')
xgb_model.fit(X_train, y_train)
xgb_preds = xgb_model.predict(X_test)

comparatif_results['XGBoost'] = {
    'accuracy': round(accuracy_score(y_test, xgb_preds) * 100, 2),
    'report': classification_report(y_test, xgb_preds, output_dict=True)
}
joblib.dump(xgb_model, os.path.join(BASE_DIR, 'models', 'xgboost_model.pkl'))

# Sauvegarde des resultats au format JSON
metrics_path = os.path.join(BASE_DIR, 'models', 'models_comparison.json')
with open(metrics_path, 'w') as f:
    json.dump(comparatif_results, f, indent=4)

print(f"Resultats sauvegardes dans : {metrics_path}")

# Affichage des performances
for model_name, res in comparatif_results.items():
    print(f" -> {model_name} : Accuracy = {res['accuracy']}%")