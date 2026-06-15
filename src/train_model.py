import psycopg2
import pandas as pd
import joblib
import os
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

def charger_donnees():
    try:
        engine = create_engine("postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db")
        query = """
            SELECT cpu_usage_pct, ram_usage_pct, cpu_temperature_celsius, 
                   disk_io_rate, network_latency_ms, system_status 
            FROM server_metrics;
        """
        df = pd.read_sql_query(query, engine)
        return df
    except Exception as e:
        print(f"Erreur : {e}")
        return None

def entrainer_pipeline_ia():
    df = charger_donnees()
    if df is None or df.empty:
        return

    X = df[['cpu_usage_pct', 'ram_usage_pct', 'cpu_temperature_celsius', 'disk_io_rate', 'network_latency_ms']]
    y = df['system_status']

    # Séparation 70% train / 30% test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.30, random_state=42)

    model = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    
    print(f"Accuracy : {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred))

    os.makedirs('models', exist_ok=True)
    joblib.dump(model, 'models/random_forest_model.pkl')

if __name__ == "__main__":
    entrainer_pipeline_ia()