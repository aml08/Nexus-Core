import pandas as pd
import joblib
import os
import json
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, '..', 'data', 'telemetry_metrics.csv')

df = pd.read_csv(CSV_PATH)

X = df[['cpu_usage_pct', 'ram_usage_pct', 'cpu_temperature_celsius', 'disk_io_rate', 'network_latency_ms']]
y = df['system_status']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

# Random Forest
rf_model = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
rf_model.fit(X_train, y_train)
rf_preds = rf_model.predict(X_test)
rf_accuracy = accuracy_score(y_test, rf_preds)

print("=== Random Forest ===")
print(f"Accuracy : {rf_accuracy:.4f}")
print(classification_report(y_test, rf_preds))

# XGBoost
xgb_model = XGBClassifier(n_estimators=100, random_state=42, eval_metric='mlogloss')
xgb_model.fit(X_train, y_train)
xgb_preds = xgb_model.predict(X_test)
xgb_accuracy = accuracy_score(y_test, xgb_preds)

print("\n=== XGBoost ===")
print(f"Accuracy : {xgb_accuracy:.4f}")
print(classification_report(y_test, xgb_preds))

# Validation croisée
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

rf_cv_scores = cross_val_score(rf_model, X, y, cv=skf, scoring='accuracy')
xgb_cv_scores = cross_val_score(xgb_model, X, y, cv=skf, scoring='accuracy')

print("\n=== Validation croisée ===")
print(f"Random Forest CV mean : {rf_cv_scores.mean():.4f} (+/- {rf_cv_scores.std():.4f})")
print(f"XGBoost CV mean : {xgb_cv_scores.mean():.4f} (+/- {xgb_cv_scores.std():.4f})")

rf_gap = rf_accuracy - rf_cv_scores.mean()
xgb_gap = xgb_accuracy - xgb_cv_scores.mean()
print(f"Écart Test-CV Random Forest : {rf_gap:.4f}")
print(f"Écart Test-CV XGBoost : {xgb_gap:.4f}")

os.makedirs(os.path.join(BASE_DIR, '..', 'models'), exist_ok=True)
joblib.dump(rf_model, os.path.join(BASE_DIR, '..', 'models', 'random_forest_model.pkl'))
joblib.dump(xgb_model, os.path.join(BASE_DIR, '..', 'models', 'xgboost_model.pkl'))

comparatif_results = {
    'Random_Forest': {
        'accuracy_test': round(rf_accuracy * 100, 2),
        'cv_mean': round(rf_cv_scores.mean() * 100, 2),
        'cv_std': round(rf_cv_scores.std() * 100, 2),
        'test_cv_gap': round(rf_gap * 100, 2),
        'report': classification_report(y_test, rf_preds, output_dict=True)
    },
    'XGBoost': {
        'accuracy_test': round(xgb_accuracy * 100, 2),
        'cv_mean': round(xgb_cv_scores.mean() * 100, 2),
        'cv_std': round(xgb_cv_scores.std() * 100, 2),
        'test_cv_gap': round(xgb_gap * 100, 2),
        'report': classification_report(y_test, xgb_preds, output_dict=True)
    }
}

with open(os.path.join(BASE_DIR, '..', 'models', 'models_comparison_cv.json'), 'w') as f:
    json.dump(comparatif_results, f, indent=4)