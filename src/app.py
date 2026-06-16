from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import os
import random
import json
from sqlalchemy import create_engine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, '..', 'templates')
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db')

engine = None
try:
    engine = create_engine(DATABASE_URL)
except Exception as db_err:
    engine = None

models = {}
model_files = {
    'random_forest': 'random_forest_model.pkl',
    'logistic_regression': 'logistic_regression_model.pkl',
    'xgboost': 'xgboost_model.pkl'
}

for model_key, file_name in model_files.items():
    path = os.path.join(BASE_DIR, '..', 'models', file_name)
    if os.path.exists(path):
        models[model_key] = joblib.load(path)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/model-comparison', methods=['GET'])
def get_comparison():
    path = os.path.join(BASE_DIR, '..', 'models', 'models_comparison.json')
    if os.path.exists(path):
        with open(path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({'error': 'Fichier introuvable'}), 404

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    selected_model_key = data.get('model_key', 'random_forest')
    current_model = models.get(selected_model_key)
    
    if not current_model:
        return jsonify({'status': 'error', 'message': 'Modele indisponible'}), 500
        
    try:
        input_data = pd.DataFrame([{
            'cpu_usage_pct': data['cpu_usage_pct'],
            'ram_usage_pct': data['ram_usage_pct'],
            'cpu_temperature_celsius': data['cpu_temperature_celsius'],
            'disk_io_rate': data['disk_io_rate'],
            'network_latency_ms': data['network_latency_ms']
        }])
        
        prediction = int(current_model.predict(input_data)[0])
        
        if hasattr(current_model, "predict_proba"):
            probabilities = current_model.predict_proba(input_data)[0].tolist()
        else:
            probabilities = [0.0, 0.0, 0.0]
            probabilities[prediction] = 1.0
            
        return jsonify({
            'status': 'success',
            'model_used': selected_model_key,
            'prediction': prediction,
            'probabilities': {
                'optimal': probabilities[0],
                'warning': probabilities[1],
                'critical': probabilities[2]
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Route API modifiee pour gerer le multi-sites et les previsions de pannes
@app.route('/api/live-data', methods=['GET'])
def get_live_data():
    site = request.args.get('site', 'RNT-PRD-01')
    
    # Tentative de lecture de la base SQL
    try:
        if engine is not None:
            query = f"SELECT * FROM server_metrics WHERE server_id = '{site}' ORDER BY timestamp DESC LIMIT 1;"
            df = pd.read_sql_query(query, engine)
            if not df.empty:
                return jsonify(df.to_dict(orient='records'))
    except Exception as sql_err:
        pass

    # Generateur dynamique multi-sites pour la demo entreprise
    timestamp = pd.Timestamp.now().isoformat()
    
    if site == 'RNT-BRX-02':
        # Bordeaux : Site stable et froid
        cpu = round(random.uniform(15.0, 35.0), 1)
        temp = round(random.uniform(38.0, 45.0), 1)
        status = 0
    elif site == 'RNT-DKR-03':
        # Dakar : Simulation d'une surchauffe progressive (Panne dans 3 heures)
        cpu = round(random.uniform(78.0, 92.0), 1)
        temp = round(random.uniform(72.0, 84.0), 1)
        status = 2
    else:
        # Paris (Standard)
        cpu = round(random.uniform(30.0, 55.0), 1)
        temp = round(random.uniform(50.0, 58.0), 1)
        status = 0

    mock_data = [{
        'timestamp': timestamp,
        'server_id': site,
        'cpu_usage_pct': cpu,
        'ram_usage_pct': round(random.uniform(60.0, 80.0), 1),
        'cpu_temperature_celsius': temp,
        'disk_io_rate': round(random.uniform(100.0, 150.0), 1),
        'network_latency_ms': round(random.uniform(10.0, 25.0), 1),
        'system_status': status
    }]
    return jsonify(mock_data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
