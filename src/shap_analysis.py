import pandas as pd
import joblib
import os
import shap
import matplotlib.pyplot as plt

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, '..', 'data', 'telemetry_metrics.csv')
MODEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'xgboost_model.pkl')

df = pd.read_csv(CSV_PATH)
X = df[['cpu_usage_pct', 'ram_usage_pct', 'cpu_temperature_celsius', 'disk_io_rate', 'network_latency_ms']]

model = joblib.load(MODEL_PATH)

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)

shap.summary_plot(shap_values, X, plot_type="bar", show=False)
plt.tight_layout()
plt.savefig(os.path.join(BASE_DIR, '..', 'shap_summary_bar.png'), dpi=150)
plt.close()

print("Graphique SHAP sauvegardé : shap_summary_bar.png")