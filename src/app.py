from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import os
from sqlalchemy import create_engine

# Configuration des dossiers pour le HTML et CSS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, '..', 'templates')
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

# Récupération de l'URL PostgreSQL 
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db')

engine = None
try:
    engine = create_engine(DATABASE_URL)
    # Petit test rapide pour voir si la base répond
    with engine.connect() as conn:
        print("Connexion à la base de données PostgreSQL réussie.")
except Exception as db_err:
    print(f"Avertissement : Base de données non joignable (normal en mode démo Cloud) : {db_err}")
    engine = None

# Route principale 
@app.route('/')
def home():
    return render_template('index.html')

# Route API pour les prédictions
@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({'status': 'error', 'message': 'Modèle indisponible'}), 500
    try:
        data = request.get_json()
        input_data = pd.DataFrame([{
            'cpu_usage_pct': data['cpu_usage_pct'],
            'ram_usage_pct': data['ram_usage_pct'],
            'cpu_temperature_celsius': data['cpu_temperature_celsius'],
            'disk_io_rate': data['disk_io_rate'],
            'network_latency_ms': data['network_latency_ms']
        }])
        
        prediction = int(model.predict(input_data)[0])
        probabilities = model.predict_proba(input_data)[0].tolist()
        
        return jsonify({
            'status': 'success',
            'prediction': prediction,
            'probabilities': {
                'optimal': probabilities[0],
                'warning': probabilities[1],
                'critical': probabilities[2]
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Route API pour récupérer les dernières données en base 
import random

@app.route('/api/live-data', methods=['GET'])
def get_live_data():
    try:
        # On tente de lire la vraie base de données
        query = "SELECT * FROM server_metrics ORDER BY timestamp DESC LIMIT 5;"
        df = pd.read_sql_query(query, engine)
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        print(f"Base locale inaccessible, bascule sur le flux de démo : {e}")
        # Mode Démo pour ton URL Render : Génère des données à la volée pour le Dashboard
        cpu = round(random.uniform(20.0, 75.0), 1)
        temp = round(random.uniform(45.0, 70.0), 1)
        
        # Simulation d'une prédiction de l'IA à la volée pour la démo
        statut_ia = 0
        if cpu > 70.0 or temp > 65.0:
            statut_ia = 1 # Warning
            
        mock_data = [{
            'timestamp': pd.Timestamp.now().isoformat(),
            'server_id': 'RNT-PRD-01',
            'cpu_usage_pct': cpu,
            'ram_usage_pct': round(random.uniform(40.0, 60.0), 1),
            'cpu_temperature_celsius': temp,
            'disk_io_rate': round(random.uniform(100.0, 300.0), 1),
            'network_latency_ms': round(random.uniform(10.0, 25.0), 1),
            'system_status': statut_ia
        }]
        return jsonify(mock_data)
