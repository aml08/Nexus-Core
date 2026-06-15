from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import os
import random
from sqlalchemy import create_engine

# Configuration des dossiers pour le HTML et CSS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, '..', 'templates')
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

# Récupération de l'URL PostgreSQL (Locale par défaut, ou Cloud si définie)
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+psycopg2://postgres:postgres@localhost:5432/nexus_db')

engine = None
try:
    engine = create_engine(DATABASE_URL)
    # Simple vérification passive sans bloquer
    print("Moteur de base de données configuré.")
except Exception as db_err:
    print(f"Mode démo activé, base de données non connectée : {db_err}")
    engine = None

# Chargement du modèle IA
MODEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'random_forest_model.pkl')
try:
    model = joblib.load(MODEL_PATH)
    print("Modèle IA chargé avec succès.")
except Exception as e:
    print(f"Erreur chargement modèle : {e}")
    model = None

# Route principale : affiche ton interface HTML
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

# Route API pour récupérer les dernières données en base (avec fallback Démo)
@app.route('/api/live-data', methods=['GET'])
def get_live_data():
    # Fallback automatique si engine est absent ou si la requête SQL échoue
    try:
        if engine is not None:
            query = "SELECT * FROM server_metrics ORDER BY timestamp DESC LIMIT 5;"
            df = pd.read_sql_query(query, engine)
            if not df.empty:
                return jsonify(df.to_dict(orient='records'))
    except Exception as sql_err:
        print(f"Lecture SQL échouée, bascule démo : {sql_err}")
    
    # Génération de données dynamiques pour l'affichage Render en continu
    cpu = round(random.uniform(25.0, 68.0), 1)
    temp = round(random.uniform(48.0, 62.0), 1)
    statut_ia = 0
    if cpu > 65.0 or temp > 60.0:
        statut_ia = 1
        
    mock_data = [{
        'timestamp': pd.Timestamp.now().isoformat(),
        'server_id': 'RNT-PRD-01',
        'cpu_usage_pct': cpu,
        'ram_usage_pct': round(random.uniform(45.0, 55.0), 1),
        'cpu_temperature_celsius': temp,
        'disk_io_rate': round(random.uniform(120.0, 250.0), 1),
        'network_latency_ms': round(random.uniform(12.0, 18.0), 1),
        'system_status': statut_ia
    }]
    return jsonify(mock_data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
