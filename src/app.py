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
engine = create_engine(DATABASE_URL)

# Chargement du modèle IA
MODEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'random_forest_model.pkl')
try:
    model = joblib.load(MODEL_PATH)
    print("Modèle IA chargé avec succès.")
except Exception as e:
    print(f"Erreur chargement modèle : {e}")
    model = None

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
@app.route('/api/live-data', methods=['GET'])
def get_live_data():
    try:
        query = "SELECT * FROM server_metrics ORDER BY timestamp DESC LIMIT 5;"
        df = pd.read_sql_query(query, engine)
        return jsonify(df.to_dict(orient='records'))
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    # Récupération du port dynamique pour le Cloud 
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)